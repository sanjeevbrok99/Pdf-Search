import { ChevronDown } from 'lucide-react';

export enum Grade {
  ALL = 'all',
  KINDERGARTEN = 'K',
  GRADE_1 = '1',
  GRADE_2 = '2',
  GRADE_3 = '3',
  GRADE_4 = '4',
  GRADE_5 = '5',
  GRADE_6 = '6',
  GRADE_7 = '7',
  GRADE_8 = '8',
  GRADE_9 = '9',
  GRADE_10 = '10',
  GRADE_11 = '11',
  GRADE_12 = '12',
}

type GradeOption = {
  id: number;
  label: string;
  value: string | null;
};

const gradeOptions: GradeOption[] = [
  { id: 0, label: "All Grades", value: null },
  { id: 1, label: "Kindergarten", value: "K" },
  { id: 2, label: "Grade 1", value: "1" },
  { id: 3, label: "Grade 2", value: "2" },
  { id: 4, label: "Grade 3", value: "3" },
  { id: 5, label: "Grade 4", value: "4" },
  { id: 6, label: "Grade 5", value: "5" },
  { id: 7, label: "Grade 6", value: "6" },
  { id: 8, label: "Grade 7", value: "7" },
  { id: 9, label: "Grade 8", value: "8" },
  { id: 10, label: "Grade 9", value: "9" },
  { id: 11, label: "Grade 10", value: "10" },
  { id: 12, label: "Grade 11", value: "11" },
  { id: 13, label: "Grade 12", value: "12" },
];

interface GradeDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function GradeDropdown({ value, onChange }: GradeDropdownProps) {
  return (
    <div className="relative h-full">
      <select 
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-full px-4 pr-8 bg-gray-100 border border-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-400"
      >
        {gradeOptions.map((option) => (
          <option key={option.id} value={option.value ?? ''}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    </div>
  );
}