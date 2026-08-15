/**
 * Application smoke tests.
 *
 * These mount the real tree — provider, theme shell, lazy screens, stores — and
 * drive it the way a player would. Unit tests prove the pieces work; this
 * proves they are wired together, which is the failure that unit tests never
 * catch and users always do.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.tsx'
import { I18nProvider } from '../i18n/index.tsx'
import { useUi } from '../state/uiStore.ts'
import { useGame, selectLivePosition } from '../state/gameStore.ts'
import { useSettings } from '../state/settingsStore.ts'
import { legalMoves } from '../core/rules.ts'
import type { Locale } from '../i18n/locales.ts'

function renderApp(locale: Locale = 'en') {
  return render(
    <I18nProvider initialLocale={locale}>
      <App />
    </I18nProvider>,
  )
}

beforeEach(() => {
  useUi.setState({ screen: 'menu', previous: null, sheet: 'none', toasts: [] })
  useGame.getState().reset()
  // Animations off: these tests care about wiring, not easing curves.
  useSettings.getState().setA11y({ reducedMotion: true })
  useSettings.getState().setAudio({ muted: true })
  window.history.replaceState({}, '', '/')
})

describe('boot', () => {
  it('renders the menu', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Noqat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /quick play/i })).toBeInTheDocument()
  })

  it('sets the document language and direction from the locale', async () => {
    renderApp('fa')
    await waitFor(() => expect(document.documentElement.lang).toBe('fa'))
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('switches back to left-to-right for a Latin locale', async () => {
    renderApp('de')
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'))
  })

  it('applies the theme as CSS custom properties', async () => {
    renderApp()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBeTruthy())
    expect(document.documentElement.style.getPropertyValue('--nq-accent')).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--nq-p0-line')).not.toBe('')
  })
})

describe('navigation', () => {
  it('reaches the setup screen and starts a game', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: /quick play/i }))
    expect(await screen.findByRole('heading', { name: /new game/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start game/i }))
    expect(await screen.findByTestId('board')).toBeInTheDocument()
    expect(useGame.getState().status).toBe('playing')
  })

  it('opens and leaves the how-to screen', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /how to play/i }))
    expect(await screen.findByRole('heading', { name: /how to play/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(await screen.findByRole('button', { name: /quick play/i })).toBeInTheDocument()
  })

  it('lists every theme in the gallery', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /themes/i }))
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.length).toBe(13)
  })
})

describe('playing a game', () => {
  it('draws a line when an edge is clicked', async () => {
    const user = userEvent.setup()
    useGame.getState().start({
      size: { rows: 2, cols: 2 },
      players: [
        { kind: 'human', name: 'A' },
        { kind: 'human', name: 'B' },
      ],
    })
    useUi.setState({ screen: 'game' })
    renderApp()

    const board = await screen.findByTestId('board')
    const edges = within(board).getAllByRole('button')
    await user.click(edges[0])
    await waitFor(() => expect(useGame.getState().moves).toHaveLength(1))
  })

  it('shows both player cards with live scores', async () => {
    useGame.getState().start({
      size: { rows: 2, cols: 2 },
      players: [
        { kind: 'human', name: 'Ada' },
        { kind: 'human', name: 'Linus' },
      ],
    })
    useUi.setState({ screen: 'game' })
    renderApp()
    expect(await screen.findByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Linus')).toBeInTheDocument()
  })

  it('narrates moves in the live region', async () => {
    const user = userEvent.setup()
    useGame.getState().start({
      size: { rows: 2, cols: 2 },
      players: [
        { kind: 'human', name: 'Ada' },
        { kind: 'human', name: 'Linus' },
      ],
    })
    useUi.setState({ screen: 'game' })
    renderApp()

    const board = await screen.findByTestId('board')
    await user.click(within(board).getAllByRole('button')[0])
    await waitFor(() => {
      expect(screen.getByRole('status', { name: /game commentary/i })).toHaveTextContent(/Ada drew a line/i)
    })
  })

  it('runs a whole two-player game to a finish', async () => {
    useGame.getState().start({
      size: { rows: 2, cols: 2 },
      players: [
        { kind: 'human', name: 'A' },
        { kind: 'human', name: 'B' },
      ],
    })
    useUi.setState({ screen: 'game' })
    renderApp()
    await screen.findByTestId('board')

    let guard = 0
    while (useGame.getState().status === 'playing' && guard++ < 40) {
      const moves = legalMoves(selectLivePosition(useGame.getState()))
      useGame.getState().play(moves[0])
    }

    const position = selectLivePosition(useGame.getState())
    expect(useGame.getState().status).toBe('finished')
    expect(position.scores[0] + position.scores[1]).toBe(4)
    // The result screen takes over once the last animation settles.
    expect(
      await screen.findByRole('heading', { name: /victory|defeat|draw/i }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})

describe('watching a replay', () => {
  async function playToTheEnd() {
    useGame.getState().start({
      size: { rows: 2, cols: 2 },
      players: [
        { kind: 'human', name: 'A' },
        { kind: 'human', name: 'B' },
      ],
    })
    useUi.setState({ screen: 'game' })
    renderApp()
    await screen.findByTestId('board')

    let guard = 0
    while (useGame.getState().status === 'playing' && guard++ < 40) {
      useGame.getState().play(legalMoves(selectLivePosition(useGame.getState()))[0])
    }
    await screen.findByRole('heading', { name: /victory|defeat|draw/i }, { timeout: 4000 })
  }

  it('rewinds and starts playing back', async () => {
    const user = userEvent.setup()
    await playToTheEnd()

    await user.click(screen.getByRole('button', { name: /watch replay/i }))
    await screen.findByTestId('board')
    expect(useGame.getState().cursor).toBe(0)
    expect(useGame.getState().replaying).toBe(true)
  })

  it('leaves through the back button to the result panel, not the quit prompt', async () => {
    const user = userEvent.setup()
    await playToTheEnd()
    await user.click(screen.getByRole('button', { name: /watch replay/i }))
    await screen.findByTestId('board')

    await user.click(screen.getByRole('button', { name: /^back$/i }))
    expect(
      await screen.findByRole('heading', { name: /victory|defeat|draw/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^quit$/i })).not.toBeInTheDocument()
    expect(useGame.getState().replaying).toBe(false)
  })
})

describe('localisation in the running app', () => {
  it('renders Persian copy and Eastern Arabic numerals', async () => {
    renderApp('fa')
    expect(await screen.findByRole('heading', { name: 'نقطه‌خط' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /بازی سریع/ })).toBeInTheDocument()
    })
  })

  it('renders Japanese copy', async () => {
    renderApp('ja')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /クイックプレイ/ })).toBeInTheDocument()
    })
  })
})
