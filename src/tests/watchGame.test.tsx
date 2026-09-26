// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { simulateGame } from '../simulation/engine/game';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { GameBoxScorePage } from '../components/GameBoxScorePage';
import { WatchGame } from '../components/WatchGame';

afterEach(cleanup);
function fixture(){const home=buildDemoTeam('HOME','Home'),away=buildDemoTeam('AWAY','Away');return {game:simulateGame({home,away,settings:{...DEFAULT_GAME_SETTINGS,injuriesEnabled:false,seed:411}}),home:{teamId:'HOME',name:'Home'},away:{teamId:'AWAY',name:'Away'},homeRoster:home.seasons,awayRoster:away.seasons};}
describe('court viewer controls',()=>{
 it('hides the final score, pauses, changes speed, steps and finishes without mutating the recorded game',()=>{
  const props=fixture();const original=JSON.stringify(props.game);const onBoxScore=vi.fn();
  const {container}=render(<WatchGame {...props} onBoxScore={onBoxScore}/>);
  expect(screen.getByTestId('watch-home-score').textContent).toBe('0');
  expect(container.querySelectorAll('.court-player')).toHaveLength(10);
  fireEvent.click(screen.getByRole('button',{name:'Pause'}));expect(screen.getByText('PAUSED')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Playback speed'),{target:{value:'4'}});expect((screen.getByLabelText('Playback speed') as HTMLSelectElement).value).toBe('4');
  fireEvent.click(screen.getByRole('button',{name:'Next Possession'}));
  expect(screen.getByTestId('watch-home-score').textContent).toBe(String(props.game.possessionLog[0].homeScoreAfter));
  fireEvent.click(screen.getByRole('button',{name:'Sim to End'}));
  expect(screen.getByTestId('watch-home-score').textContent).toBe(String(props.game.homeScore));
  expect(screen.getByTestId('watch-away-score').textContent).toBe(String(props.game.awayScore));
  expect((screen.getByRole('button',{name:'Sim to End'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'View Box Score'}));expect(onBoxScore).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Restart Replay'}));expect(screen.getByTestId('watch-home-score').textContent).toBe('0');
  expect(JSON.stringify(props.game)).toBe(original);
 });
 it('shows the TV score bug and only charts shots that have already happened',()=>{
  const props=fixture();const {container}=render(<WatchGame {...props} onBoxScore={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Pause'}));
  expect(screen.getByTestId('court-score-bug')).toBeTruthy();
  expect(container.querySelector('[data-testid="court-shot-chart"]')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Sim to End'}));
  const marks=container.querySelectorAll('[data-testid="court-shot-chart"] > *').length;
  const fga=Object.values({...props.game.homeBox.players,...props.game.awayBox.players}).reduce((n,p)=>n+p.fga,0);
  expect(marks).toBeGreaterThan(0);expect(marks).toBeLessThanOrEqual(fga);
  fireEvent.click(screen.getByLabelText('Shot chart'));
  expect(container.querySelector('[data-testid="court-shot-chart"]')).toBeNull();
 });
 it('opens directly from Watch Next, returns to the real box score and allows replay again',()=>{
  render(<GameBoxScorePage {...fixture()} initialWatch/>);
  expect(screen.queryByText('Home leaders:',{exact:false})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Skip to Box Score'}));
  expect(screen.queryByRole('region',{name:'Watch Game'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Watch Game'}));
  expect(screen.getByTestId('watch-home-score').textContent).toBe('0');
 });
 it('keeps a legacy game without a log accessible',()=>{
  const props=fixture();props.game.possessionLog=[];
  render(<WatchGame {...props} onBoxScore={()=>{}}/>);
  expect(screen.getByText(/no possession log/)).toBeTruthy();expect(screen.getByRole('button',{name:'View Box Score'})).toBeTruthy();
 });
});
