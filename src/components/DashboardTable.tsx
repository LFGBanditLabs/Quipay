interface Row {
  job: string;
  status: string;
  action: string;
}

export default function DashboardTable({ data }: { data: Row[] }) {
  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Job</th>
              <th className="px-4 py-2 border">Status</th>
              <th className="px-4 py-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2 border">{row.job}</td>
                <td className="px-4 py-2 border">{row.status}</td>
                <td className="px-4 py-2 border">
                  <button className="bg-blue-500 text-white px-4 py-2 rounded min-h-[44px] min-w-[44px]">
                    {row.action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-4">
        {data.map((row, idx) => (
          <div key={idx} className="border rounded-lg p-4 shadow-sm bg-white">
            <p className="font-semibold">Job: {row.job}</p>
            <p>Status: {row.status}</p>
            <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded w-full min-h-[44px]">
              {row.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
