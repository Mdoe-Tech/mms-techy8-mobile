import { Banknote } from 'lucide-react-native';

import { MobileTextInput } from './MobileTextInput';

type MobileAmountInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  helperText?: string;
  error?: string;
  disabled?: boolean;
};

export function MobileAmountInput({ label, value, onChangeText, helperText, error, disabled }: MobileAmountInputProps) {
  return (
    <MobileTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder="TZS 0"
      helperText={helperText}
      error={error}
      keyboardType="decimal-pad"
      icon={Banknote}
      disabled={disabled}
    />
  );
}
