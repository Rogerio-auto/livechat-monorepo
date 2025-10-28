// components/DataTable.jsx
export default function DataTable() {
  const rows = [
    {
      numero: "0000073-99",
      status: "VE",
      data: "22/08/2025",
      nome: "MARLI NOBRE DA CRUZ DE ARAUJO",
      valor: 22000,
    },
    {
      numero: "0000072-99",
      status: "OR",
      data: "21/08/2025",
      nome: "ANDERSON RICARDO DUARTE DE CARVALHO",
      valor: 17897,
    },
    {
      numero: "0000071-99",
      status: "VE",
      data: "19/08/2025",
      nome: "Clodoaldo Pinheiro Filho",
      valor: 11900,
    },
    {
      numero: "0000070-99",
      status: "OR",
      data: "19/08/2025",
      nome: "CAROLAYNE SANTOS ALVES",
      valor: 21476,
    },
    {
      numero: "0000069-99",
      status: "OR",
      data: "19/08/2025",
      nome: "Trícia Lopes Rocha",
      valor: 17897,
    },
  ];

  return (
    <div className="overflow-x-auto rounded-xl shadow">
      <table className="min-w-full text-sm text-left border-collapse">
        <thead className="bg-gray-100 text-gray-700 font-semibold">
          <tr>
            <th className="px-4 py-2">Número</th>
            <th className="px-4 py-2">status</th>
            <th className="px-4 py-2">Data</th>
            <th className="px-4 py-2">Nome</th>
            <th className="px-4 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => (
            <tr
              key={idx}
              className="border-b hover:bg-gray-50 transition"
            >
              <td className="px-4 py-2">{item.numero}</td>
              <td className="px-4 py-2">
                <span
                  className={`px-2 py-1 rounded-full text-white text-xs font-bold ${
                    item.status === "VE" ? "bg-[#42CD55]" : "bg-[#FF8800]"
                  }`}
                >
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-2">{item.data}</td>
              <td className="px-4 py-2">{item.nome}</td>
              <td className="px-4 py-2 text-right">
                {item.valor.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}