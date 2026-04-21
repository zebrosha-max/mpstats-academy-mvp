'use client';

import { PhoneInput as BasePhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, disabled }: PhoneInputProps) {
  return (
    <BasePhoneInput
      defaultCountry="ru"
      value={value}
      onChange={(phone) => onChange(phone)}
      disabled={disabled}
      inputClassName="!h-10 !w-full !rounded-md !border-input !bg-background !text-sm !ring-offset-background placeholder:!text-muted-foreground focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-ring focus-visible:!ring-offset-2 disabled:!cursor-not-allowed disabled:!opacity-50"
      countrySelectorStyleProps={{
        buttonClassName:
          '!h-10 !rounded-md !border-input !bg-background hover:!bg-accent disabled:!cursor-not-allowed disabled:!opacity-50',
      }}
      className="!w-full !gap-1.5"
    />
  );
}
