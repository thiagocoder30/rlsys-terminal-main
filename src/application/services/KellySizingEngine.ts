export interface KellyInput {
  bankroll: number;
  confidence: number;
}

export interface KellyOutput {
  stake: number;
}

export class KellySizingEngine {

  calculate(input: KellyInput): KellyOutput {

    const bankroll = input.bankroll;
    const confidence = input.confidence;

    const rawStake =
      bankroll *
      Math.max(0, confidence);

    const rounded =
      Math.max(
        0.10,
        Math.round(rawStake * 10) / 10
      );

    return {
      stake: rounded
    };
  }
}
