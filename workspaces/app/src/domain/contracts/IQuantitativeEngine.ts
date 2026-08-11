import { QuantitativeInput } from '../intelligence/common/QuantitativeInput';
import { QuantitativeOutput } from '../intelligence/common/QuantitativeOutput';

export interface IQuantitativeEngine {
  readonly engineName: string;
  execute(input: QuantitativeInput): QuantitativeOutput;
}
