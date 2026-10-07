import { sapHandlers } from "./sap.handlers";
import { vexpensesHandlers } from "./vexpenses.handlers";
import { bankplusHandlers } from "./bankplus.handlers";

export const allHandlers = [...sapHandlers, ...vexpensesHandlers, ...bankplusHandlers];
