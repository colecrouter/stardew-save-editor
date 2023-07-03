import { base } from '$app/paths';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
    const data = await fetch(base + '/cookingrecipes.json');
    const recipes = await data.json() as Array<string>;

    return {
        recipes,
    };
};