import { Banknote } from 'lucide-react-native';

import { MobileTextInput } from './MobileTextInput';

type MobileAmountInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  helperText?: string;
};

export function MobileAmountInput({ label, value, onChangeText, helperText }: MobileAmountInputProps) {
  return (
    <MobileTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder="TZS 0"
      helperText={helperText}
      keyboardType="decimal-pad"
      icon={Banknote}
    />
  );
}

