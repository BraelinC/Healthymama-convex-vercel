"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Flag from "react-world-flags";
import { cn } from "@/lib/utils";

const CUISINES = [
  { id: "italian", label: "Italian", countryCode: "IT" },
  { id: "mexican", label: "Mexican", countryCode: "MX" },
  { id: "chinese", label: "Chinese", countryCode: "CN" },
  { id: "thai", label: "Thai", countryCode: "TH" },
  { id: "indian", label: "Indian", countryCode: "IN" },
  { id: "japanese", label: "Japanese", countryCode: "JP" },
  { id: "mediterranean", label: "Mediterranean", emoji: "🫒" },
  { id: "american", label: "American", countryCode: "US" },
  { id: "french", label: "French", countryCode: "FR" },
  { id: "korean", label: "Korean", countryCode: "KR" },
  { id: "middle-eastern", label: "Middle Eastern", emoji: "🧆" },
  { id: "greek", label: "Greek", countryCode: "GR" },
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "ZA", name: "South Africa" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "GR", name: "Greece" },
  { code: "TR", name: "Turkey" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "VE", name: "Venezuela" },
  { code: "EC", name: "Ecuador" },
  { code: "BO", name: "Bolivia" },
  { code: "UY", name: "Uruguay" },
  { code: "PY", name: "Paraguay" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panama" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "Dominican Republic" },
  { code: "PR", name: "Puerto Rico" },
  { code: "JM", name: "Jamaica" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "DZ", name: "Algeria" },
  { code: "TN", name: "Tunisia" },
  { code: "LY", name: "Libya" },
  { code: "SD", name: "Sudan" },
  { code: "ET", name: "Ethiopia" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "SN", name: "Senegal" },
  { code: "CI", name: "Ivory Coast" },
  { code: "CM", name: "Cameroon" },
  { code: "UG", name: "Uganda" },
  { code: "TZ", name: "Tanzania" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "ZM", name: "Zambia" },
  { code: "MW", name: "Malawi" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "OM", name: "Oman" },
  { code: "BH", name: "Bahrain" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "SY", name: "Syria" },
  { code: "IQ", name: "Iraq" },
  { code: "IR", name: "Iran" },
  { code: "IL", name: "Israel" },
  { code: "PS", name: "Palestine" },
  { code: "AF", name: "Afghanistan" },
  { code: "LK", name: "Sri Lanka" },
  { code: "MM", name: "Myanmar" },
  { code: "KH", name: "Cambodia" },
  { code: "LA", name: "Laos" },
  { code: "NP", name: "Nepal" },
  { code: "BT", name: "Bhutan" },
  { code: "MV", name: "Maldives" },
];

interface CuisinesStepProps {
  value?: string[];
  country?: string;
  onChange: (field: string, value: string[] | string) => void;
}

export function CuisinesStep({ value = [], country, onChange }: CuisinesStepProps) {
  const [searchText, setSearchText] = useState(country || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCountries = useMemo(() => {
    if (!searchText) return COUNTRIES;
    const search = searchText.toLowerCase();
    return COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(search)
    );
  }, [searchText]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const toggleCuisine = (cuisineId: string) => {
    const newCuisines = value.includes(cuisineId)
      ? value.filter((id) => id !== cuisineId)
      : [...value, cuisineId];
    onChange("preferredCuisines", newCuisines);
  };

  const handleCountrySelect = (c: typeof COUNTRIES[0]) => {
    setSearchText(c.name);
    onChange("country", c.name);
    setShowDropdown(false);
  };

  const handleCountryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setShowDropdown(true);
    onChange("country", e.target.value);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">
          What cuisines do you enjoy?
        </h3>
        <p className="text-sm text-gray-800 font-medium">
          Select your favorite cuisines. We'll prioritize recipes from these traditions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
        {CUISINES.map((cuisine) => (
          <div
            key={cuisine.id}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-pink-50 transition-colors"
          >
            <Checkbox
              id={cuisine.id}
              checked={value.includes(cuisine.id)}
              onCheckedChange={() => toggleCuisine(cuisine.id)}
              className="border-pink-300 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-healthymama-red data-[state=checked]:to-healthymama-logo-pink data-[state=checked]:border-pink-500"
            />
            <Label
              htmlFor={cuisine.id}
              className="text-sm font-medium cursor-pointer flex items-center gap-2 text-gray-900"
            >
              {"countryCode" in cuisine ? (
                <Flag
                  code={cuisine.countryCode}
                  className="w-6 h-4 object-cover rounded"
                  fallback={<span>🏳️</span>}
                />
              ) : (
                <span className="text-lg">{cuisine.emoji}</span>
              )}
              <span>{cuisine.label}</span>
            </Label>
          </div>
        ))}
      </div>

      {/* Add your own country section */}
      <div className="space-y-2 pt-4 border-t-2 border-pink-200">
        <Label htmlFor="country" className="text-gray-900 font-semibold">
          Or add your own country
        </Label>
        <p className="text-xs text-gray-700 font-medium">
          Type to search for your country (e.g., Peru)
        </p>
        <div className="relative" ref={dropdownRef}>
          <Input
            id="country"
            type="text"
            value={searchText}
            onChange={handleCountryInputChange}
            onFocus={() => setShowDropdown(true)}
            placeholder="Type to search... (e.g., Peru)"
            className="text-base text-gray-900 border-pink-200 focus:ring-pink-500 focus:border-pink-500 bg-white"
          />

          {showDropdown && filteredCountries.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border-2 border-pink-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredCountries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-pink-50 transition-colors border-b border-pink-100 last:border-b-0",
                    searchText === c.name && "bg-pink-50"
                  )}
                >
                  <Flag
                    code={c.code}
                    className="w-8 h-6 object-cover rounded border border-gray-200"
                    fallback={<span>🏳️</span>}
                  />
                  <span className="text-gray-900 font-medium">{c.name}</span>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchText && filteredCountries.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border-2 border-pink-200 rounded-lg shadow-lg p-4">
              <p className="text-gray-600 text-sm">
                No countries found. Keep typing or select from suggestions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
