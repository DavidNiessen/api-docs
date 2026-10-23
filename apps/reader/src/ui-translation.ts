import { createContext, useContext } from 'react';
import { createUiTranslation } from '@api-docs/contracts';
export const UiContext = createContext(createUiTranslation('en'));
export function useUi() {
  return useContext(UiContext).text;
}
