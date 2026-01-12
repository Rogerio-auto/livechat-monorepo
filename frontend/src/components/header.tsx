export function Header() {
  return (
    <header
      className="
        fixed top-0 left-0 w-full z-50
        flex justify-end items-center
        py-3 px-4 
      "
    >
      <div className="flex items-center gap-4">
        <button className="bg-[#FF8800] text-white px-4 py-1 rounded-md shadow">
          KiuSeven Energia Solar
        </button>
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
          R
        </div>
      </div>
    </header>
  );
}
