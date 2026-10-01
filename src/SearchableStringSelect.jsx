import { useState, useEffect, useRef } from "react";

export default function SearchableStringSelect({
  options,
  onSelect,
  placeholder,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className="border border-borderMain p-2 rounded w-full bg-panel text-textMain text-sm focus:border-primary outline-none"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onClick={() => setIsOpen(true)}
      />
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-panel border border-borderMain rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <div
              key={opt}
              className="p-2 text-sm hover:bg-primary-light cursor-pointer"
              onClick={() => {
                onSelect(opt);
                setSearch("");
                setIsOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
