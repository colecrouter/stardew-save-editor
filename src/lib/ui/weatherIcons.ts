import sun from "./art/weather/sun.png";
import rain from "./art/weather/rain.png";
import greenRain from "./art/weather/green-rain.png";
import storm from "./art/weather/storm.png";
import snow from "./art/weather/snow.png";
import springWind from "./art/weather/wind-spring.png";
import fallWind from "./art/weather/wind-fall.png";
import festival from "./art/weather/festival.png";
import wedding from "./art/weather/wedding.png";

const icons = {
	Sun: sun,
	Rain: rain,
	GreenRain: greenRain,
	Storm: storm,
	Snow: snow,
	Festival: festival,
	Wedding: wedding,
} as const;

/** Unknown/modded weather has no inferred picture; its text remains authoritative. */
export function weatherIconUrl(
	weather: string,
	season: string,
): string | undefined {
	if (weather === "Wind")
		return season === "winter"
			? snow
			: season === "fall"
				? fallWind
				: springWind;
	return Object.hasOwn(icons, weather)
		? icons[weather as keyof typeof icons]
		: undefined;
}
