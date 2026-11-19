#!/usr/bin/env bash
# Database-level verification: reloads the schema + sample data, then checks the
# invariants the overbooking engine must always hold and hammers the booking
# procedures with parallel sessions.
#
#   ./scripts/verify-db.sh                 (uses `mariadb`)
#   MARIADB="sudo mariadb" ./scripts/verify-db.sh
#
# WARNING: drops and recreates the hotel_crs database.

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
MARIADB="${MARIADB:-mariadb}"

pass=0; fail=0
q()  { $MARIADB hotel_crs -N -B -e "$1" 2>&1; }
ok() { pass=$((pass + 1)); printf '  ok   %s\n' "$1"; }
no() { fail=$((fail + 1)); printf '  FAIL %s (%s)\n' "$1" "$2"; }
expect() { [[ "$2" == "$3" ]] && ok "$1" || no "$1" "expected '$3', got '$2'"; }

echo "Loading schema and sample data"
$MARIADB < SQL/hotel_crs_ddl.sql || exit 1
$MARIADB < SQL/hotel_crs_dml.sql > /dev/null || exit 1

echo; echo "Seed data"
expect "9 room types, 38 physical rooms"  "$(q "SELECT CONCAT((SELECT COUNT(*) FROM room_type),',',(SELECT COUNT(*) FROM room))")" "9,38"
expect "every status is represented"      "$(q "SELECT COUNT(DISTINCT booking_status) FROM booking")" "3"
expect "one cancelled + refunded booking" "$(q "SELECT COUNT(*) FROM vw_booking_details WHERE booking_status='Cancelled' AND payment_status='Refunded'")" "1"
expect "one guest waiting on the walkthrough nights" "$(q "SELECT COUNT(*) FROM booking WHERE booking_status='Waitlisted'")" "1"
expect "overbooked bookings exist"        "$(q "SELECT COUNT(*) >= 2 FROM booking WHERE is_overbooked")" "1"
expect "room_type.total_rooms matches room rows" "$(q "SELECT COUNT(*) FROM room_type rt WHERE rt.total_rooms <> (SELECT COUNT(*) FROM room r WHERE r.room_type_id = rt.room_type_id)")" "0"

echo; echo "Procedure behaviour"
q "CALL sp_create_booking(1,3,CURRENT_DATE+INTERVAL 100 DAY,CURRENT_DATE+INTERVAL 101 DAY,2,NULL,@b,@s); SELECT @s" > /tmp/vdb.$$; expect "booking confirmed"        "$(cat /tmp/vdb.$$)" "CONFIRMED"
expect "past check-in refused"      "$(q "CALL sp_create_booking(1,3,CURRENT_DATE-INTERVAL 1 DAY,CURRENT_DATE+INTERVAL 1 DAY,2,NULL,@b,@s); SELECT @s")" "INVALID_DATES"
expect "unknown guest refused"      "$(q "CALL sp_create_booking(999,3,CURRENT_DATE+INTERVAL 5 DAY,CURRENT_DATE+INTERVAL 6 DAY,2,NULL,@b,@s); SELECT @s")" "INVALID_GUEST"
expect "over-capacity party refused" "$(q "CALL sp_create_booking(1,3,CURRENT_DATE+INTERVAL 5 DAY,CURRENT_DATE+INTERVAL 6 DAY,9,NULL,@b,@s); SELECT @s")" "INVALID_GUESTS"
expect "payment unique guard"       "$(q "INSERT INTO payment (booking_id,amount,payment_method) SELECT booking_id,1,'Card' FROM payment WHERE payment_status='Completed' LIMIT 1" | grep -c 'uq_one_live_payment')" "1"
expect "walkthrough: 6th booking is buffer, 7th was promoted" "$(q "SELECT CONCAT(SUM(is_overbooked),'/',COUNT(*)) FROM booking WHERE room_type_id=1 AND check_in_date=CURRENT_DATE+INTERVAL 10 DAY AND booking_status='Confirmed'")" "2/6"
rm -f /tmp/vdb.$$

echo; echo "Concurrency (12 sessions fight for 2 suites)"
d1="CURRENT_DATE+INTERVAL 40 DAY"; d2="CURRENT_DATE+INTERVAL 42 DAY"
for i in $(seq 1 12); do
  q "CALL sp_create_booking($(( i % 10 + 1 )),3,$d1,$d2,2,NULL,@b,@s)" > /dev/null &
done; wait
expect "exactly 2 confirmed"  "$(q "SELECT COUNT(*) FROM booking WHERE room_type_id=3 AND check_in_date=$d1 AND booking_status='Confirmed'")" "2"
expect "10 waitlisted"        "$(q "SELECT COUNT(*) FROM booking WHERE room_type_id=3 AND check_in_date=$d1 AND booking_status='Waitlisted'")" "10"
expect "ledger says 2 / night" "$(q "SELECT GROUP_CONCAT(booked_count) FROM room_type_inventory WHERE room_type_id=3 AND stay_date >= $d1 AND stay_date < $d2")" "2,2"

target="$(q "SELECT booking_id, guest_id FROM booking WHERE room_type_id=3 AND check_in_date=$d1 AND booking_status='Confirmed' ORDER BY booking_id LIMIT 1")"
bid="${target%%$'\t'*}"; gid="${target##*$'\t'}"
for i in 1 2 3 4; do q "CALL sp_cancel_booking($bid,$gid,'race',@s)" > /dev/null & done; wait
expect "4 parallel cancels -> one refund row"     "$(q "SELECT COUNT(*) FROM cancellation_history WHERE booking_id=$bid")" "1"
expect "cancel freed exactly one slot for the oldest waiter" "$(q "SELECT COUNT(*) FROM booking WHERE room_type_id=3 AND check_in_date=$d1 AND booking_status='Confirmed'")" "2"
expect "ledger still 2 / night" "$(q "SELECT GROUP_CONCAT(booked_count) FROM room_type_inventory WHERE room_type_id=3 AND stay_date >= $d1 AND stay_date < $d2")" "2,2"

# two paid, overlapping bookings race for the same physical room
q "CALL sp_record_payment(14,4,'Card',@s,@p,@a); CALL sp_record_payment(15,5,'Card',@s,@p,@a)" > /dev/null
for i in 1 2 3; do
  q "DELETE FROM room_assignment WHERE booking_id IN (14,15)" > /dev/null
  for b in 14 15; do q "INSERT INTO room_assignment (booking_id, room_id) VALUES ($b, 4)" > /dev/null & done; wait
  expect "assignment race round $i: one winner" "$(q "SELECT COUNT(*) FROM room_assignment WHERE room_id=4")" "1"
done

echo; echo "Mixed concurrency (30 creates, then 8 cancels + 20 creates + payments at once)"
m1="CURRENT_DATE+INTERVAL 30 DAY"; m2="CURRENT_DATE+INTERVAL 32 DAY"
rm -rf /tmp/vdb_mix.$$; mkdir -p /tmp/vdb_mix.$$
for i in $(seq 1 30); do q "CALL sp_create_booking($(( i % 10 + 1 )),7,$m1,$m2,2,NULL,@b,@s); SELECT @s" > /tmp/vdb_mix.$$/c$i & done; wait
q "SELECT booking_id, guest_id FROM booking WHERE room_type_id=7 AND check_in_date=$m1 AND booking_status='Confirmed' LIMIT 8" > /tmp/vdb_mix.$$/cancel.txt
q "SELECT booking_id, guest_id FROM booking WHERE room_type_id=7 AND check_in_date=$m1 AND booking_status='Confirmed' LIMIT 2 OFFSET 8" > /tmp/vdb_mix.$$/pay.txt
while read -r b g; do q "CALL sp_cancel_booking($b,$g,'mix',@s); SELECT @s" > /tmp/vdb_mix.$$/x$b & done < /tmp/vdb_mix.$$/cancel.txt
while read -r b g; do q "CALL sp_record_payment($b,$g,'Card',@s,@p,@a); SELECT @s" > /tmp/vdb_mix.$$/p$b & done < /tmp/vdb_mix.$$/pay.txt
for i in $(seq 31 50); do q "CALL sp_create_booking($(( i % 10 + 1 )),7,$m1,$m2,2,NULL,@b,@s); SELECT @s" > /tmp/vdb_mix.$$/c$i & done; wait
expect "no operation ended in ERROR (no deadlocks)" "$(cat /tmp/vdb_mix.$$/* | grep -c '^ERROR$')" "0"
expect "all 8 cancels succeeded"                    "$(cat /tmp/vdb_mix.$$/x* | grep -c '^CANCELLED$')" "8"
expect "confirmed never exceeds the sellable ceiling" "$(q "SELECT COUNT(*) FROM booking WHERE room_type_id=7 AND check_in_date=$m1 AND booking_status='Confirmed'")" "10"
expect "waiters filled the freed slots (none left over while rooms are free)" "$(q "SELECT fn_available_rooms(7, $m1)")" "0"
expect "no transaction left open on any connection" "$(q "SELECT COUNT(*) FROM information_schema.innodb_trx WHERE trx_mysql_thread_id <> CONNECTION_ID()")" "0"
rm -rf /tmp/vdb_mix.$$

echo; echo "Global invariants after the stress"
expect "ledger equals active bookings per night" "$(q "
  SELECT COUNT(*) FROM room_type_inventory i
  LEFT JOIN (SELECT b.room_type_id, DATE_ADD(b.check_in_date, INTERVAL n.i DAY) d, COUNT(*) c
             FROM booking b
             JOIN (WITH RECURSIVE s(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM s WHERE i<60) SELECT i FROM s) n
               ON DATE_ADD(b.check_in_date, INTERVAL n.i DAY) < b.check_out_date
             WHERE b.booking_status='Confirmed' GROUP BY 1,2) x
    ON x.room_type_id=i.room_type_id AND x.d=i.stay_date
  WHERE i.booked_count <> COALESCE(x.c,0)")" "0"
expect "no room is double-assigned" "$(q "
  SELECT COUNT(*) FROM room_assignment a JOIN booking ba ON ba.booking_id=a.booking_id
  JOIN room_assignment b ON b.room_id=a.room_id AND b.assignment_id>a.assignment_id
  JOIN booking bb ON bb.booking_id=b.booking_id
  WHERE ba.check_in_date<bb.check_out_date AND bb.check_in_date<ba.check_out_date")" "0"
expect "at most one live payment per booking" "$(q "SELECT COUNT(*) FROM (SELECT booking_id FROM payment WHERE payment_status='Completed' GROUP BY booking_id HAVING COUNT(*)>1) t")" "0"
expect "assigned rooms only on confirmed, paid bookings" "$(q "SELECT COUNT(*) FROM room_assignment ra JOIN booking b USING(booking_id) WHERE b.booking_status<>'Confirmed' OR NOT EXISTS (SELECT 1 FROM payment p WHERE p.booking_id=b.booking_id AND p.payment_status='Completed')")" "0"
expect "no night sold beyond total + 2 x base buffer" "$(q "
  SELECT COUNT(*) FROM room_type_inventory i JOIN room_type rt USING(room_type_id)
  LEFT JOIN overbooking_policy op USING(room_type_id)
  WHERE i.booked_count > rt.total_rooms + 2*FLOOR(rt.total_rooms*COALESCE(op.overbook_percentage,0)/100)")" "0"

echo; echo "Reloading clean sample data"
$MARIADB < SQL/hotel_crs_ddl.sql && $MARIADB < SQL/hotel_crs_dml.sql > /dev/null

echo; echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
