export default function Loading() {
  return (
    <div className="container-page py-16">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-4 h-10 w-2/3 max-w-xl" />
      <div className="skeleton mt-3 h-4 w-1/2 max-w-md" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-56" />
        ))}
      </div>
    </div>
  );
}
