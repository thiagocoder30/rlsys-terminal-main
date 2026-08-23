export interface FusionReducedDoctrineSnapshot {
  readonly strategyId:
    'fusion-reduced';

  readonly centerNumber:
    23;

  readonly leftNeighbors:
    9;

  readonly rightNeighbors:
    9;

  readonly totalCoverage:
    19;

  readonly targetNumbers:
    readonly number[];

  readonly wheel:
    'EUROPEAN';

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly automaticExecutionAllowed:
    false;
}


/**
 * Fusion Reduzida Doctrine.
 *
 * Esta classe define SOMENTE a identidade matemática
 * da estratégia.
 *
 * Não decide entrada.
 * Não calcula gatilho.
 * Não possui stake.
 * Não possui execução.
 *
 * Contrato:
 *
 * Centro = 23
 * Esquerda = 9 vizinhos
 * Direita = 9 vizinhos
 * Total = 19 números
 */
export class FusionReducedDoctrineEngine {

  public snapshot():
    FusionReducedDoctrineSnapshot {

    return Object.freeze({

      strategyId:
        'fusion-reduced' as const,

      centerNumber:
        23 as const,

      leftNeighbors:
        9 as const,

      rightNeighbors:
        9 as const,

      totalCoverage:
        19 as const,

      targetNumbers:
        Object.freeze(
          this.buildTargetNumbers(),
        ),

      wheel:
        'EUROPEAN' as const,

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      automaticExecutionAllowed:
        false as const,
    });
  }


  public targetNumbers():
    readonly number[] {

    return Object.freeze(
      this.buildTargetNumbers(),
    );
  }


  private buildTargetNumbers():
    number[] {

    const wheel =
      [
        0, 32, 15, 19, 4, 21, 2,
        25, 17, 34, 6, 27, 13,
        36, 11, 30, 8, 23, 10,
        5, 24, 16, 33, 1, 20,
        14, 31, 9, 22, 18, 29,
        7, 28, 12, 35, 3, 26,
      ];

    const centerIndex =
      wheel.indexOf(
        23,
      );

    const numbers: number[] =
      [];

    for (
      let offset = -9;
      offset <= 9;
      offset += 1
    ) {
      const index =
        (
          centerIndex +
          offset +
          wheel.length
        ) %
        wheel.length;

      numbers.push(
        wheel[index],
      );
    }

    return numbers;
  }
}
