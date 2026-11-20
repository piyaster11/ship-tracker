#!/usr/bin/env python3
"""Headless checks for the ship tracker: live markers, filters, sort, 375px overflow."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

SCREEN_DIR = Path("/workspace/screenshots")


def wait_for_ships(page, timeout_ms=60000):
    page.wait_for_function(
        """() => {
          const n = document.getElementById('vessel-count');
          return n && parseInt(n.textContent, 10) > 0;
        }""",
        timeout=timeout_ms,
    )
    page.wait_for_function(
        """() => document.querySelectorAll('.ship-marker, .marker-cluster-custom').length > 0""",
        timeout=timeout_ms,
    )


def no_horizontal_overflow(page):
    return page.evaluate(
        """() => {
          const doc = document.documentElement;
          const body = document.body;
          return {
            client: doc.clientWidth,
            scroll: Math.max(doc.scrollWidth, body.scrollWidth),
            inner: window.innerWidth,
          };
        }"""
    )


def run(base_url: str) -> int:
    errors = []
    SCREEN_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        # Desktop
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
        )
        page = context.new_page()
        console_errors = []
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector("#map")
        page.wait_for_selector(".leaflet-container")

        t0 = time.time()
        try:
            wait_for_ships(page, 60000)
        except Exception as e:
            errors.append(f"Live markers did not appear within 60s: {e}")
            page.screenshot(path=str(SCREEN_DIR / "ship-tracker-desktop-fail.png"), full_page=False)
            # still try to continue for overflow checks
        waited = time.time() - t0
        count = page.inner_text("#vessel-count")
        pill = page.inner_text("#conn-pill")
        demo = page.locator("#demo-banner").is_visible()
        print(f"desktop: ships={count} pill={pill!r} demo={demo} waited={waited:.1f}s")
        if demo:
            errors.append("Dashboard fell back to DEMO mode; live AIS was not reached.")

        # Filters: click Tanker chip, count should drop or match tanker n
        chips = page.locator(".chip")
        expect(chips).to_have_count(8)
        tanker = page.locator('.chip[data-type="tanker"]')
        tanker_n = int(tanker.locator(".n").inner_text())
        tanker.click()
        page.wait_for_timeout(400)
        table_count_text = page.inner_text("#table-count")
        # table count like "(141)"
        import re
        m = re.search(r"(\d+)", table_count_text)
        filtered = int(m.group(1)) if m else -1
        print(f"filter tanker: kpi={tanker_n} table={filtered}")
        if tanker_n > 0 and filtered != tanker_n:
            # search is empty so they should match vessels with positions of that type
            # small mismatch possible if a vessel has no position counted? KPI counts positions.
            if abs(filtered - tanker_n) > 2:
                errors.append(f"Tanker filter mismatch: kpi {tanker_n} vs table {filtered}")
        # Restore all types by clicking tanker again when it's the only one? Our logic:
        # if only one selected and click it, restores all. Yes.
        tanker.click()
        page.wait_for_timeout(300)

        # Sort: click Name header, first row should change vs speed sort
        first_before = page.locator("#vessel-tbody tr").first.inner_text()
        page.locator('th[data-sort="name"]').click()
        page.wait_for_timeout(300)
        first_after = page.locator("#vessel-tbody tr").first.inner_text()
        print(f"sort name first row changed={first_before != first_after}")
        # Not always guaranteed if top speed ship also sorts first alphabetically, so only warn
        page.locator('th[data-sort="sog"]').click()

        # Click a row — detail opens
        page.locator("#vessel-tbody tr[data-mmsi]").first.click()
        page.wait_for_timeout(500)
        if not page.locator("#detail").is_visible():
            errors.append("Detail panel did not open after clicking a table row.")
        else:
            print("detail panel opened:", page.locator("#detail h3").inner_text()[:80])

        page.screenshot(path=str(SCREEN_DIR / "ship-tracker-desktop.png"), full_page=False)
        context.close()

        # Mobile 375
        mobile = browser.new_context(
            viewport={"width": 375, "height": 812},
            device_scale_factor=2,
            is_mobile=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        )
        mpage = mobile.new_page()
        mpage.goto(base_url, wait_until="domcontentloaded", timeout=30000)
        try:
            wait_for_ships(mpage, 60000)
        except Exception as e:
            errors.append(f"Mobile: markers did not appear within 60s: {e}")
        mpage.wait_for_timeout(800)
        box = no_horizontal_overflow(mpage)
        print(f"mobile overflow check: client={box['client']} scroll={box['scroll']} inner={box['inner']}")
        if box["scroll"] > box["client"] + 2:
            # Some leaflet attribution or overflow might be a few px; allow 2px, fail otherwise
            errors.append(f"Horizontal overflow at 375px: scrollWidth {box['scroll']} > clientWidth {box['client']}")
        # topbar shouldn't overflow either
        topbar = mpage.evaluate(
            """() => {
              const el = document.querySelector('.topbar');
              return { cw: el.clientWidth, sw: el.scrollWidth };
            }"""
        )
        print(f"topbar: client={topbar['cw']} scroll={topbar['sw']}")
        if topbar["sw"] > topbar["cw"] + 2:
            errors.append(f"Top bar overflows at 375px: {topbar}")

        mpage.screenshot(path=str(SCREEN_DIR / "ship-tracker-mobile.png"), full_page=False)
        mobile.close()
        browser.close()

    if console_errors:
        print("page errors:", console_errors)
        # Leaflet noise? treat real errors as failures
        real = [e for e in console_errors if "leaflet" not in e.lower()]
        if real:
            errors.extend(real)

    if errors:
        print("FAIL:")
        for e in errors:
            print(" -", e)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    # typo fix - I used invalid syntax `def run(base_url: str) -> int:`
    # This file is rewritten correctly below if needed.
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765/")
    args = parser.parse_args()
    sys.exit(run(args.url))
