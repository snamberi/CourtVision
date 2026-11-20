import { useAccount } from '../cloud/account';
import { localName, levelFor } from '../profile/profile';
import { gemBalance, type RelicState } from '../relics/relics';
import { AccountButton } from './cloud/AccountButton';
import { NotificationApp } from './cloud/NotificationCentre';
import { MyAvatar } from './UserAvatar';
import { PixelIcon } from './PixelIcon';

interface Props {
  xp: number;
  wallet: RelicState;
  onProfile: () => void;
  onBoards: () => void;
  onShop: () => void;
  onPhone: () => void;
  onFriends: () => void;
  onFriendList: () => void;
}

export function MenuMasthead({ xp, wallet, onProfile, onBoards, onShop, onPhone, onFriends, onFriendList }: Props) {
  const account = useAccount();
  const level = levelFor(xp);
  const name = account.profile?.username || localName();
  return <header className="arena-header">
    <a className="arena-brand" href="#/menu" aria-label="CourtVision home"><PixelIcon name="hoop" size={35} /><span>CourtVision</span></a>
    <div className="arena-header-tools">
      <button type="button" className="arena-account" onClick={onProfile} aria-label={`Profile for ${name}, level ${level.level}`} title={`${xp.toLocaleString()} XP`}>
        <span className="arena-portrait"><MyAvatar mode="portrait" size={34} animate={false} title="" /></span>
        <span className="arena-player"><b>{name}</b><small>Lv. {level.level} <progress aria-label="Level progress" max={level.need || 1} value={level.need ? level.into : 1} /></small></span>
      </button>
      <div className="arena-wallet">{([['coin', 'coins', wallet.coins], ['gem', 'gems', gemBalance(wallet)]] as const).map(([art, label, value]) =>
        <button key={art} type="button" onClick={onShop} aria-label={`${value.toLocaleString()} ${label}, open shop`}>
          <PixelIcon name={art} size={18} /><b>{value.toLocaleString()}</b></button>)}</div>
      <AccountButton onCommunity={onBoards} onProfile={onProfile} boards={false} signedInChip={false} />
      <span className="arena-header-icons"><NotificationApp onFriends={onFriends} onFriendList={onFriendList} />
        <button className="arena-phone-button" aria-label="Open menu phone" title="Menu phone" onClick={onPhone}><PixelIcon name="phone" size={21} /></button></span>
    </div>
  </header>;
}
