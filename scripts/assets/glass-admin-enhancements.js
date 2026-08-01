const GLASS_ADMIN_MANAGED_ROUTE_RE = /^\/admin\/theme_managed(?=\/|$)/
const GLASS_ADMIN_SCROLLABLE_RE = /auto|scroll|overlay/
const GLASS_ADMIN_NUMBERED_SECTION_RE = /^\d+\s*[·.、-]\s*/

;(() => {
  const NAV_CLASS = 'glass-theme-managed-nav'
  const ACTIVE_CLASS = 'is-active'
  const ROOT_CLASS = 'glass-theme-managed-page'
  const HEADER_CLASS = 'glass-theme-managed-header'
  const SEPARATOR_CLASS = 'glass-theme-managed-separator'
  const BOTTOM_SAVE_CLASS = 'glass-theme-managed-bottom-save'
  const SECTION_ID_PREFIX = 'glass-theme-section-'
  const SECTION_HEADING_SELECTOR = '.rt-Heading.mt-4'

  let scheduled = false
  let currentPage = null
  let scrollTarget = null
  let scrollEventTarget = null
  let onScroll = null
  let headerResizeObserver = null
  let currentSignature = ''

  function elementIsVisible(element) {
    const style = getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  }

  function commonAncestor(first, second) {
    const ancestors = new Set()
    let current = first
    while (current) {
      ancestors.add(current)
      current = current.parentElement
    }

    current = second
    while (current) {
      if (ancestors.has(current))
        return current
      current = current.parentElement
    }
    return null
  }

  function findManagedPage() {
    if (!GLASS_ADMIN_MANAGED_ROUTE_RE.test(window.location.pathname))
      return null

    const root = document.querySelector('#root')
    if (!root)
      return null

    const sectionHeadings = Array.from(root.querySelectorAll(SECTION_HEADING_SELECTOR))
      .filter(elementIsVisible)
    const saveButton = Array.from(root.querySelectorAll('button'))
      .find(button => elementIsVisible(button) && button.textContent.trim() === '保存')
      || Array.from(root.querySelectorAll('button')).find(button => elementIsVisible(button))
    if (sectionHeadings.length === 0 || !saveButton)
      return null

    const shared = commonAncestor(sectionHeadings[0], saveButton)
    if (!shared)
      return null

    let candidate = sectionHeadings[0].parentElement
    while (candidate && candidate !== shared && !candidate.contains(saveButton))
      candidate = candidate.parentElement

    const page = candidate || shared
    if (page.matches('.rt-Flex.p-2.md\\:p-4'))
      return page
    return page.closest('.rt-Flex.p-2.md\\:p-4') || page
  }

  function findScrollableAncestor(element) {
    let current = element.parentElement
    while (current && current !== document.body) {
      const style = getComputedStyle(current)
      if (GLASS_ADMIN_SCROLLABLE_RE.test(`${style.overflowY} ${style.overflow}`))
        return current
      current = current.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  function getScrollTop(target) {
    return target === document.scrollingElement || target === document.documentElement
      ? window.scrollY
      : target.scrollTop
  }

  function setScrollTop(target, top, behavior) {
    if (target === document.scrollingElement || target === document.documentElement)
      window.scrollTo({ top, behavior })
    else
      target.scrollTo({ top, behavior })
  }

  function getScrollViewportTop(target) {
    return target === document.scrollingElement || target === document.documentElement
      ? 0
      : target.getBoundingClientRect().top
  }

  function isAtScrollEnd(target) {
    if (target === document.scrollingElement || target === document.documentElement) {
      const root = document.documentElement
      return window.scrollY + window.innerHeight >= root.scrollHeight - 4
    }
    return target.scrollTop + target.clientHeight >= target.scrollHeight - 4
  }

  function clearBindings() {
    if (scrollEventTarget && onScroll)
      scrollEventTarget.removeEventListener('scroll', onScroll)
    if (onScroll)
      window.removeEventListener('resize', onScroll)
    headerResizeObserver?.disconnect()
    scrollTarget = null
    scrollEventTarget = null
    onScroll = null
    headerResizeObserver = null
    currentPage = null
    currentSignature = ''
  }

  function sectionLabel(heading) {
    return heading.textContent
      .trim()
      .replace(GLASS_ADMIN_NUMBERED_SECTION_RE, '')
  }

  function findPageParts(page) {
    const headings = Array.from(page.querySelectorAll(SECTION_HEADING_SELECTOR))
      .filter(elementIsVisible)
    const saveButton = Array.from(page.querySelectorAll('button'))
      .find(button => elementIsVisible(button) && button.textContent.trim() === '保存')
      || Array.from(page.querySelectorAll('button')).find(elementIsVisible)
    const header = saveButton?.closest('.rt-Flex') || null
    const settings = headings[0]?.parentElement || null
    return { header, settings, headings }
  }

  function markBottomSave(page, header) {
    const headerButton = header.querySelector(':scope > button')
    if (!headerButton)
      return

    const label = headerButton.textContent.trim()
    const duplicate = Array.from(page.querySelectorAll('button'))
      .find(button => button !== headerButton && button.textContent.trim() === label)
    if (!duplicate)
      return

    let wrapper = duplicate
    while (wrapper.parentElement && wrapper.parentElement !== page)
      wrapper = wrapper.parentElement
    wrapper.classList.add(BOTTOM_SAVE_CLASS)
  }

  function updateActiveNav(page, header, nav, headings) {
    const nearTop = !scrollTarget
      || page.getBoundingClientRect().top - getScrollViewportTop(scrollTarget) >= -24
    const threshold = header.getBoundingClientRect().bottom + nav.offsetHeight + 96
    let activeIndex = -1
    if (!nearTop && scrollTarget && isAtScrollEnd(scrollTarget)) {
      activeIndex = headings.length - 1
    }
    else if (!nearTop) {
      for (let index = 0; index < headings.length; index += 1) {
        if (headings[index].getBoundingClientRect().top <= threshold)
          activeIndex = index
        else
          break
      }
    }

    const buttons = Array.from(nav.querySelectorAll('button'))
    buttons.forEach((button, index) => {
      const active = index === activeIndex + 1
      button.classList.toggle(ACTIVE_CLASS, active)
      button.setAttribute('aria-selected', String(active))
      if (active)
        button.setAttribute('aria-current', 'location')
      else
        button.removeAttribute('aria-current')
    })

    const activeButton = buttons[activeIndex + 1]
    if (activeButton) {
      const left = activeButton.offsetLeft
      const right = left + activeButton.offsetWidth
      if (left < nav.scrollLeft)
        nav.scrollTo({ left, behavior: 'smooth' })
      else if (right > nav.scrollLeft + nav.clientWidth)
        nav.scrollTo({ left: right - nav.clientWidth, behavior: 'smooth' })
    }
  }

  function scrollToSection(page, header, nav, heading) {
    const target = scrollTarget || findScrollableAncestor(page)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior = reduceMotion ? 'auto' : 'smooth'
    const stickyHeight = header.offsetHeight + nav.offsetHeight + 14
    const targetRect = (heading || page).getBoundingClientRect()
    const top = getScrollTop(target)
      + targetRect.top
      - getScrollViewportTop(target)
      - (heading ? stickyHeight : 0)

    setScrollTop(target, Math.max(0, top), behavior)
  }

  function buildNavigation(page, header, settings, headings) {
    let nav = page.querySelector(`:scope > .${NAV_CLASS}`)
    if (!nav) {
      nav = document.createElement('nav')
      nav.className = NAV_CLASS
      nav.setAttribute('aria-label', '主题设置分类')
      nav.setAttribute('role', 'tablist')
      settings.before(nav)
    }
    nav.previousElementSibling?.classList.add(SEPARATOR_CLASS)

    const items = [{ label: '全部设置', heading: null }].concat(
      headings.map((heading, index) => {
        heading.id = `${SECTION_ID_PREFIX}${index + 1}`
        heading.classList.add(
          'glass-theme-managed-section',
          `glass-theme-managed-section-tone-${index % 7 + 1}`,
        )
        return { label: sectionLabel(heading), heading }
      }),
    )

    const signature = items.map(item => item.label).join('\u0000')
    if (nav.dataset.signature !== signature) {
      nav.replaceChildren()
      items.forEach(({ label, heading }) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = label
        button.setAttribute('role', 'tab')
        if (heading)
          button.setAttribute('aria-controls', heading.id)
        button.addEventListener('click', () => {
          Array.from(nav.querySelectorAll('button')).forEach((item) => {
            const active = item === button
            item.classList.toggle(ACTIVE_CLASS, active)
            item.setAttribute('aria-selected', String(active))
          })
          scrollToSection(page, header, nav, heading)
        })
        nav.appendChild(button)
      })
      nav.dataset.signature = signature
    }
    return { nav, signature }
  }

  function install() {
    scheduled = false
    const page = findManagedPage()
    if (!page) {
      clearBindings()
      return
    }

    const { header, settings, headings } = findPageParts(page)
    if (!header || !settings || headings.length === 0)
      return

    page.classList.add(ROOT_CLASS)
    header.classList.add(HEADER_CLASS)
    markBottomSave(page, header)
    const { nav, signature } = buildNavigation(page, header, settings, headings)

    if (currentPage !== page || currentSignature !== signature) {
      clearBindings()
      currentPage = page
      currentSignature = signature
      scrollTarget = findScrollableAncestor(page)
      scrollEventTarget = scrollTarget === document.scrollingElement || scrollTarget === document.documentElement
        ? window
        : scrollTarget
      onScroll = () => updateActiveNav(page, header, nav, headings)
      scrollEventTarget.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll, { passive: true })
      headerResizeObserver = new ResizeObserver(() => {
        page.style.setProperty('--glass-managed-header-height', `${header.offsetHeight}px`)
        updateActiveNav(page, header, nav, headings)
      })
      headerResizeObserver.observe(header)
    }

    page.style.setProperty('--glass-managed-header-height', `${header.offsetHeight}px`)
    updateActiveNav(page, header, nav, headings)
  }

  function scheduleInstall() {
    if (scheduled)
      return
    scheduled = true
    requestAnimationFrame(install)
  }

  new MutationObserver(scheduleInstall).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  window.addEventListener('popstate', scheduleInstall)
  scheduleInstall()
})()
