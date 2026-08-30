export class CliRenderer {

  public banner(): string {
    return [
      'RL.SYS CORE',
      'Enterprise Operator CLI',
      'Supervised Decision Intelligence Mode',
      '-----------------------------------',
    ].join('\n');
  }

  public format(output: string): string {
    return output;
  }
}
