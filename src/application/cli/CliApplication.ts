import { CliCommandRouter } from './CliCommandRouter.js';
import { CliRenderer } from './CliRenderer.js';

import type {
  CliCommandContext,
} from './CliCommandContext.js';

import type {
  CliCommand,
} from './CliCommand.js';


export class CliApplication {

  private readonly router: CliCommandRouter;

  private readonly renderer: CliRenderer;

  private readonly context: CliCommandContext;


  public constructor(
    kernel: unknown,
  ) {

    this.router = new CliCommandRouter();

    this.renderer = new CliRenderer();


    this.context = Object.freeze({
      kernel,
      startedAtEpochMs: Date.now(),
    });

  }


  public register(
    command: CliCommand,
  ): void {

    this.router.register(command);

  }


  public getRouter(): CliCommandRouter {

    return this.router;

  }


  public async execute(
    input: string,
  ): Promise<string> {

    const result =
      await this.router.execute(
        input,
        this.context,
      );


    if (!result.success) {

      return this.renderer.format(
        `[ERROR] ${result.output}`,
      );

    }


    return this.renderer.format(
      result.output,
    );

  }


  public getBanner(): string {

    return this.renderer.banner();

  }

}
