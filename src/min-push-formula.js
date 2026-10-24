// Visual only. min-push.js and min-push.worker.js perform a finite search.
// The hat marks the sampled minimum, not a proof of global optimality.
export const OPTIMAL_FORCE_OBJECTIVE = String.raw`\widehat{F}_{\star}
  =\min_{\substack{
      F\in\mathcal{F}\\[-1pt]
      \tau\in\mathcal{T},\;\theta_{0}\in\Theta
    }} F`;
export const RETURN_CONSTRAINTS = String.raw`\mathrm{subject\;to}\quad
\begin{cases}
\displaystyle\min_{t\in\mathcal{R}} x_{\mathrm T}(t)\le x_{\mathrm T}(0)\\[7pt]
\displaystyle\min_{t\in\mathcal{R}} x_{\mathrm S}(t)\le x_{\mathrm S}(0)
\end{cases}`;
// R is the interval of motion after spring separation; the two crossings
// do not need to occur at the same instant.
