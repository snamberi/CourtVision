export const SANDBOX_TABS = new Set(['bulk', 'fastEdit', 'code', 'lab', 'imports']);
export const canEditTeam = (sandbox: boolean, controlledTeamId: string | null | undefined, teamId: string) => sandbox || (!!controlledTeamId && controlledTeamId === teamId);
