"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  children: React.ReactNode;
  title?: string;
}

const PRESET_COLORS = [
  // Row 1 - Light colors
  "#FFFFFF", "#F8F9FA", "#E9ECEF", "#DEE2E6", "#CED4DA", "#ADB5BD", "#6C757D", "#495057",
  // Row 2 - Medium colors  
  "#343A40", "#212529", "#000000", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  // Row 3 - Vibrant colors
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9", "#F8C471", "#82E0AA", "#F1948A",
  // Row 4 - Dark colors
  "#8E44AD", "#2980B9", "#27AE60", "#F39C12", "#E74C3C", "#34495E", "#2C3E50", "#7F8C8D",
  // Row 5 - Pastel colors
  "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#E6E6FA", "#FFB6C1", "#D3D3D3",
  // Row 6 - Professional colors
  "#2E86AB", "#A23B72", "#F18F01", "#C73E1D", "#6A994E", "#8B5A2B", "#4A5568", "#2D3748"
];

export function ColorPicker({ value, onChange, children, title = "Choose Color" }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value || "#000000");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleColorSelect = (color: string) => {
    onChange(color);
    setIsOpen(false);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    onChange(color);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-4" 
        align="start"
        ref={popoverRef}
      >
        <div className="space-y-4">
          <div className="text-sm font-medium">{title}</div>
          
          {/* Preset Colors Grid */}
          <div className="grid grid-cols-8 gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                  value === color ? "border-gray-800 ring-2 ring-gray-400" : "border-gray-300"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
              />
            ))}
          </div>

          {/* Custom Color Picker */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600">Custom Color</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                placeholder="#000000"
              />
            </div>
          </div>

          {/* Clear Color Button */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleColorSelect("")}
              className="text-xs"
            >
              Clear Color
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
