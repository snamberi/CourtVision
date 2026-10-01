// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodeAvatar, FramedAvatar } from '../components/AvatarFrame';
import { encodeAvatar } from '../profile/avatarCode';
import { AVATAR_FRAMES } from '../profile/avatarFrames';
import { DEFAULT_AVATAR } from '../profile/avatar';

describe('profile-picture frames', () => {
  it('draws every frame around the portrait', () => {
    for (const f of AVATAR_FRAMES) {
      const html = renderToStaticMarkup(<FramedAvatar look={DEFAULT_AVATAR} frame={f.id} size={80} />);
      expect(html).toContain(`avf-${f.id}`);
      expect(html).toContain('user-avatar--portrait');
    }
  });
  it('shows someone else’s character from their look code, and nothing for junk', () => {
    expect(renderToStaticMarkup(<CodeAvatar code={encodeAvatar({ ...DEFAULT_AVATAR, aura: 'fire' }, 'silverWings')} />)).toContain('avf-silverWings');
    expect(renderToStaticMarkup(<CodeAvatar code={encodeAvatar(DEFAULT_AVATAR)} full />)).toContain('user-avatar--full');
    expect(renderToStaticMarkup(<CodeAvatar code="not-a-code" />)).toBe('');
  });
});
