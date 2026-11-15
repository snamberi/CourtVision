// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RewardedSpin } from '../components/relics/RewardedSpin';
vi.mock('../consent/consent', () => ({ useConsent: () => ({ advertising: true }) }));
vi.mock('../ads/adPolicy', () => ({ advertisingPermitted: () => true }));
const mocks = vi.hoisted(() => ({ save: vi.fn(), grant: vi.fn((state: object) => ({...state,luckySpins:1})) }));
vi.mock('../relics/relics', () => ({ loadRelics: () => ({adRewards:[]}), saveRelics: mocks.save, grantLuckySpins:mocks.grant }));
describe('rewarded spin completion', () => {
 beforeEach(()=>{vi.stubEnv('VITE_REWARDED_ADS_ENABLED','true');vi.clearAllMocks();});
 afterEach(()=>{cleanup();vi.unstubAllEnvs();delete window.adBreak;});
 it('does not show an offer without configuration',()=>{
  vi.stubEnv('VITE_REWARDED_ADS_ENABLED','false');
  expect(render(<RewardedSpin />).container.textContent).toBe('');
 });
 it('grants nothing when the provider is unavailable or throws',()=>{
  window.adBreak=()=>{throw new Error('unavailable');};
  render(<RewardedSpin />);fireEvent.click(screen.getByText('Check video availability'));
  expect(screen.getByRole('status').textContent).toContain('unavailable');expect(mocks.save).not.toHaveBeenCalled();
 });
 it('grants once only after completion, never for starting a video',()=>{
  window.adBreak=placement=>placement.beforeReward(()=>{placement.adViewed();placement.adViewed();placement.adBreakDone();});
  render(<RewardedSpin />);fireEvent.click(screen.getByText('Check video availability'));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Watch video for 1 Lucky Spin'));
  expect(mocks.save).toHaveBeenCalledTimes(1);expect(mocks.grant).toHaveBeenCalledTimes(1);
 });
 it('does not reward an incomplete video',()=>{
  window.adBreak=placement=>placement.beforeReward(()=>placement.adBreakDone());
  render(<RewardedSpin />);fireEvent.click(screen.getByText('Check video availability'));fireEvent.click(screen.getByText('Watch video for 1 Lucky Spin'));
  expect(mocks.save).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('No completed video');
 });
});
