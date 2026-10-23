import { createContext, useContext } from 'react';
import { bodyFieldLabel } from '../body-fields.js';
import type { BodyPath, BodyVariants } from '../body-fields.js';

export const BodyBranchContext = createContext<{
  select: (path: BodyPath, index: number | undefined) => void;
  reset: (path: BodyPath) => void;
} | null>(null);

export function BodyBranchSelector({
  variants,
  path,
}: {
  variants: BodyVariants;
  path: BodyPath;
}) {
  const actions = useContext(BodyBranchContext);
  return (
    <label className="body-variant-selector">
      Editing schema ({variants.keyword})
      <select
        aria-label={`Schema branch for body ${bodyFieldLabel(path)}`}
        value={variants.selected === undefined ? '' : String(variants.selected)}
        onChange={(event) =>
          actions?.select(
            path,
            event.target.value === '' ? undefined : Number(event.target.value),
          )
        }
      >
        <option value="">Use JSON or choose field controls</option>
        {variants.choices.map((choice, index) => (
          <option key={index} value={index}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}
