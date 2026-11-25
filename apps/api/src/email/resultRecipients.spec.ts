import { resultEmailRecipients, RecipientSide } from './resultRecipients';

const side = (o: Partial<RecipientSide>): RecipientSide => ({ displayName: 'P', accountEmail: null, resultEmails: true, guestNotifyEmail: null, ...o });

describe('resultEmailRecipients', () => {
  it('emails account holders with result emails on, naming their opponent', () => {
    const r = resultEmailRecipients(side({ displayName: 'Jeff', accountEmail: 'jeff@x.co' }), side({ displayName: 'Ray' }));
    expect(r).toEqual([{ email: 'jeff@x.co', opponentName: 'Ray' }]);
  });

  it('skips account holders who turned result emails off', () => {
    expect(resultEmailRecipients(side({ accountEmail: 'a@x.co', resultEmails: false }), side({}))).toEqual([]);
  });

  it('emails a guest only at the address they typed for this match', () => {
    const r = resultEmailRecipients(side({ displayName: 'Jeff' }), side({ displayName: 'Ray', guestNotifyEmail: 'ray@x.co' }));
    expect(r).toEqual([{ email: 'ray@x.co', opponentName: 'Jeff' }]);
  });

  it('sends one email when the same address is on both sides', () => {
    expect(resultEmailRecipients(side({ accountEmail: 'a@x.co' }), side({ guestNotifyEmail: 'a@x.co' }))).toHaveLength(1);
  });
});
