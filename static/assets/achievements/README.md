# Steam achievement artwork

Original locked and unlocked artwork from Stardew Valley's
[Steam achievement page](https://steamcommunity.com/achievements/413150?l=english),
served by Steam's image CDN. Artwork belongs to ConcernedApe and is excluded from
the repository's source-code license, as described in [LICENSE.md](../../../LICENSE.md).

`sources.json` records the source URL, SHA-256 and native dimensions of each image.
The original JPEGs are stored without re-encoding. Files are named by the game's
saved achievement ID: `15.jpg` is unlocked Cook; `15-locked.jpg` is its locked
variant. Steam's Greenhorn API name is `a0`, which maps to saved ID `0`; the other
supported Steam API names match the saved numeric IDs.

Only the 39 supported saved achievements are included. The editor loads these
files locally and does not request a Steam account or contact Steam at runtime.
Artwork state follows the imported save's award records; it does not establish
whether Steam has unlocked the corresponding platform achievement.

The asset workspace preserves this directory during `npm run dump`, since these
images do not come from extracted game content. To refresh, retrieve Steam's
English achievement metadata, verify names and API IDs against
`generated/progress.json`, and download the original `icon_achieved` and
`icon_unachieved` files. Update `sources.json` with the URLs and hashes, then run
`tests/editor/achievement-icons.test.ts` and the asset-workspace tests.
