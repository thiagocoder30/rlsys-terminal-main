import { SessionLifecycleState } from './SessionLifecycleState';

export class SessionLifecycleValidator {
    public static canTransition(current: SessionLifecycleState, next: SessionLifecycleState): boolean {
        if (next === 'NONE') return true; // clearRuntime can happen anytime

        switch (current) {
            case 'NONE':
                return next === 'CREATED';
            case 'CREATED':
                return next === 'STARTING';
            case 'STARTING':
                return next === 'ACTIVE';
            case 'ACTIVE':
                return next === 'PAUSED' || next === 'FINISHING';
            case 'PAUSED':
                return next === 'RESUMING' || next === 'FINISHING';
            case 'RESUMING':
                return next === 'ACTIVE';
            case 'FINISHING':
                return next === 'FINISHED';
            case 'FINISHED':
                return next === 'ARCHIVED';
            case 'ARCHIVED':
                return false;
            default:
                return false;
        }
    }

    public static assertTransition(current: SessionLifecycleState, next: SessionLifecycleState): void {
        if (!this.canTransition(current, next)) {
            throw new Error(`Invalid session lifecycle transition from ${current} to ${next}`);
        }
    }
}
