# SpySpaceHunter

A free, original neon cyberpunk-2099 spy-car shooter with a head nod to the classic 80s arcade road combat games. Your two-door sport car cruises an 8-lane highway all by itself; you steer, shoot, ram enemy cars off the road, dodge helicopters and bombs, and dock with the supply truck for upgrades. One endless run through a loop of zones, with a boat section in the middle of every lap.

**Play it in your browser:** https://nbwillcox.github.io/SpySpaceHunter/

Everything is generated in code: the cars, boats, trucks and scenery are vector-drawn on the fly, and all sound effects and the 8-bit-console-style music are synthesized with the Web Audio API. There are no image or audio files and no build step. A sibling of [SpaceGalaShooter](https://github.com/nbwillcox/SpaceGalaShooter), [SpaceCentiShooter](https://github.com/nbwillcox/SpaceCentiShooter) and the rest of the series.

## Controls

| Action | Keys |
| --- | --- |
| Steer | `←` `→` or `A` `D`, or move the mouse |
| Machine gun | `Space` or left mouse button |
| Missile (homing) | `C` or right mouse button |
| Oil slick (mines on the water) | `Z` |
| Smoke screen | `X` |
| EMP burst | `V` |
| Shield | `B` |
| Pause | `P` or `Esc` |

The car cruises by itself: there is no gas or brake. Every weapon and gadget has limited ammo, which you refill at the supply truck.

### On a phone or tablet

Play in portrait. A floating thumb-stick on the left steers, **FIRE** (hold) is the machine gun, and small buttons on the right are the missile, oil / mines, smoke, EMP and shield. The pause button opens the menu. The on-screen controls appear on touch devices automatically; Settings has size, opacity and a left-handed layout. Use your browser's *Add to Home Screen* to install it as a full-screen app.

## Gameplay

- **Score** comes from enemy vehicles knocked off the road or destroyed, plus 1 point for every second you survive. Credits (spent at the supply truck) are earned the same way.
- **The loop:** Neon City, Dust Belt (desert), Little Haven (small town), Harbor Ramp (your car turns into a boat), Roaring Rapids, Quiet River, Harbor Exit (back to a car), and round again. Every lap is a little faster and busier.
- **Enemies:** side-ramming sedans, nearly bulletproof black limos, gunner cars, tire-slashers, motorbike packs, and bombing helicopters (only missiles and the EMP take those down reliably). On the water: patrol boats, gunboats, floating mines, rocks and a gunship helicopter. Enemy cars come in midnight blue, black and dark velvet red, plus two-tone mixes.
- **Civilians** (ordinary traffic) are not targets: shooting or wrecking one costs 500 points.
- **Losing a car:** you have 3. You lose one if you are knocked off the road or destroyed. Damage shows as smoke, then fire, and costs you speed and handling. Armor makes your car heavier and harder to shove around; when it breaks, the car is lighter again.
- **The supply truck** (an old-school red semi, a barge on the water) drifts in from the top with no warning. Line up with its rear ramp to drive in; it slows the world, pulls over, and the shop opens. Spend credits on ammo, gadgets, shield charges, armor plating and repairs. Miss it and it is gone.
- **Water zones:** the dangers are all destruction-based, there is no falling off the road. Mines and rocks hurt, boats ram and shoot, and the rapids push you sideways.
- Local top-10 high scores with arcade-style 3-letter initials (stored in your browser).

## Run locally

It is plain HTML/CSS/JS. Either open `index.html` directly, or serve the folder:

```bash
python -m http.server 8000
```

then visit http://localhost:8000. Debug: `?zone=N` starts in zone N (0-6), `?god=1` makes you invulnerable, `?truck=1` brings the supply truck early.

## License and attribution

Licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): free to play, share and remix **non-commercially**, as long as you give credit and **link back to this repository**: https://github.com/nbwillcox/SpySpaceHunter

This is an original game inspired by classic arcade road shooters. It uses no assets, names, music or code from any existing game.
