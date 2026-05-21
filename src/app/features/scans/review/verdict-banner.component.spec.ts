import { render, screen } from '@testing-library/angular';
import { VerdictBannerComponent } from './verdict-banner.component';
import { LucideAngularModule, OctagonX, CircleCheck } from 'lucide-angular';

describe('VerdictBannerComponent', () => {
  it('should show success state when there are no blockers', async () => {
    await render(VerdictBannerComponent, {
      componentInputs: {
        blockerCount: 0,
        exposeCount: 5
      },
      imports: [LucideAngularModule.pick({ OctagonX, CircleCheck })]
    });

    expect(screen.getByText('No blocking issues')).toBeInTheDocument();
    expect(screen.getByText('5 external services will be exposed.')).toBeInTheDocument();
  });

  it('should show danger state when there are blockers', async () => {
    await render(VerdictBannerComponent, {
      componentInputs: {
        blockerCount: 2,
        exposeCount: 5
      },
      imports: [LucideAngularModule.pick({ OctagonX, CircleCheck })]
    });

    expect(screen.getByText('2 blocking issues')).toBeInTheDocument();
    expect(screen.getByText(/NTLM detected on 2 services/)).toBeInTheDocument();
  });
});
