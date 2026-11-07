// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { AnswerCard } from '../../src/components/AnswerCard'
import { CharacterImage } from '../../src/components/CharacterImage'
import { Doodle } from '../../src/components/Doodle'
import { PosterBackdrop, PosterMarquee } from '../../src/components/PosterBackdrop'
import { ProgressDots } from '../../src/components/ProgressDots'
import { TimerPill } from '../../src/components/TimerPill'
import { createStorageRepo } from '../../src/services/storage'
import { DEFAULT_SETTINGS } from '../../src/domain/seed'
import { renderApp, resetStorage } from './test-utils'

describe('ui components', () => {
  it('answer card shows letter and uses fixed color per position', () => {
    const { container } = render(
      <>
        <AnswerCard index={0}>Đáp án A</AnswerCard>
        <AnswerCard index={1}>Đáp án B</AnswerCard>
        <AnswerCard index={2}>Đáp án C</AnswerCard>
        <AnswerCard index={3}>Đáp án D</AnswerCard>
      </>,
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(container.querySelector('[data-color="sun"]')).not.toBeNull()
    expect(container.querySelector('[data-color="bubble"]')).not.toBeNull()
    expect(container.querySelector('[data-color="sky"]')).not.toBeNull()
    expect(container.querySelector('[data-color="mint"]')).not.toBeNull()
  })

  it('answer card marks correct and wrong with icon and accessible text', () => {
    const { container } = render(
      <>
        <AnswerCard index={0} state="correct">Đúng</AnswerCard>
        <AnswerCard index={1} state="wrong">Sai</AnswerCard>
      </>,
    )
    expect(screen.getByText('Đáp án đúng')).toBeInTheDocument()
    expect(screen.getByText('Đáp án sai')).toBeInTheDocument()
    expect(container.querySelector('[data-icon="correct"]')).not.toBeNull()
    expect(container.querySelector('[data-icon="wrong"]')).not.toBeNull()
  })

  it('timer pill turns danger at 5 seconds or less', () => {
    const { container, rerender } = render(<TimerPill seconds={6} />)
    expect(container.querySelector('[data-danger="false"]')).not.toBeNull()
    rerender(<TimerPill seconds={5} />)
    expect(container.querySelector('[data-danger="true"]')).not.toBeNull()
    expect(screen.getByRole('timer')).toHaveAttribute('data-danger', 'true')
  })

  it('progress dots show current question number', () => {
    const { container } = render(<ProgressDots current={2} total={5} />)
    expect(screen.getByText('Câu 2/5')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-filled]')).toHaveLength(5)
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(2)
  })

  it('character image falls back when asset is missing', () => {
    render(<CharacterImage name="mi-skate-wave" sizes="160px" />)
    const image = document.querySelector('img')
    expect(image).not.toBeNull()
    expect(image?.getAttribute('data-asset')).toBe('mi-phone-cool')
    expect(image?.getAttribute('src')).toContain('mi-phone-cool')
  })

  it('character image uses width descriptors and sizes', () => {
    render(<CharacterImage name="mi-hero-jump" priority sizes="(min-width: 768px) 40vw, 280px" />)
    const image = document.querySelector('img')
    expect(image?.getAttribute('srcset')).toContain('mi-hero-jump@1x.webp 274w')
    expect(image?.getAttribute('srcset')).toContain('mi-hero-jump@2x.webp 549w')
    expect(image?.getAttribute('srcset')).toContain('mi-hero-jump@3x.webp 823w')
    expect(image?.getAttribute('sizes')).toBe('(min-width: 768px) 40vw, 280px')
    expect(image?.getAttribute('loading')).toBe('eager')
    expect(image?.getAttribute('aria-hidden')).toBe('true')
  })

  it('race sprite srcset stays small', () => {
    render(<CharacterImage name="bin-run" sizes="36px" />)
    const image = document.querySelector('img')
    expect(image?.getAttribute('srcset')).toContain('bin-run@1x.webp 1x')
    expect(image?.getAttribute('srcset')).toContain('bin-run@2x.webp 2x')
    expect(image?.getAttribute('srcset')).not.toContain('bin-run@3x.webp')
  })

  it('decorative doodles are hidden from screen readers', () => {
    const { container } = render(<Doodle kind="star" />)
    const svg = container.querySelector('[data-doodle="star"]')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('focusable')).toBe('false')
  })

  it('poster backdrop is decorative and hidden from screen readers', () => {
    const { container } = render(<PosterBackdrop word="QUIZ!" />)
    const backdrop = container.querySelector('[data-poster-backdrop]')
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
    expect(backdrop?.className).toContain('pointer-events-none')
    expect(backdrop?.textContent).toContain('QUIZ!')
  })

  it('marquee is static when reduced motion', () => {
    const { container } = render(<PosterMarquee reducedMotion />)
    const marquee = container.querySelector('[data-poster-marquee]') as HTMLElement | null
    expect(marquee).toHaveAttribute('data-motion', 'static')
    expect(marquee?.style.animation).toBe('none')
  })

  it('gift description is shown in full on home', async () => {
    resetStorage()
    const gift = 'Voucher 50.000đ cho top 10 kèm áo thun và móc khóa phiên bản giới hạn'
    createStorageRepo().saveSettings({ ...DEFAULT_SETTINGS, giftDescription: gift })
    renderApp('/')

    expect(await screen.findByText(gift)).toBeInTheDocument()
    expect(screen.getByText('Có quà')).toBeInTheDocument()
  })
})
