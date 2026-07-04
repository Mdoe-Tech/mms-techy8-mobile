import { MobileSelect } from './MobileSelect';

type MobileDatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const demoDates = [
  { label: 'Today, 4 July 2026', value: '2026-07-04' },
  { label: 'Tomorrow, 5 July 2026', value: '2026-07-05' },
  { label: 'Next Friday, 10 July 2026', value: '2026-07-10' },
];

export function MobileDatePicker({ label, value, onChange }: MobileDatePickerProps) {
  return <MobileSelect label={label} value={value} options={demoDates} onChange={onChange} placeholder="Choose date" />;
}
