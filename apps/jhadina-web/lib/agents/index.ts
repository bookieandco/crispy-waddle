export * from "./contracts";
export * from "./janet";
export * from "./delia";
export * from "./marisa";

import { JanetAgent } from "./janet";
import { DeliaAgent } from "./delia";
import { MarisaAgent } from "./marisa";

export const agents = {
  janet: new JanetAgent(),
  delia: new DeliaAgent(),
  marisa: new MarisaAgent(),
} as const;
