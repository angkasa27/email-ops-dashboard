"use client";

import * as React from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Eye, EyeOff } from "lucide-react";

function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        type={isVisible ? "text" : "password"}
        className={className}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => setIsVisible((value) => !value)}
          aria-label={isVisible ? "Hide password" : "Show password"}
        >
          {isVisible ? (
            <EyeOff data-icon="inline-start" />
          ) : (
            <Eye data-icon="inline-start" />
          )}
          <span className="sr-only">
            {isVisible ? "Hide password" : "Show password"}
          </span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export { PasswordInput };
