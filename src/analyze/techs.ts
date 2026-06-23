export function detectTechnologies(): string[] {
    const techs: string[] = [];

    //React
    if (
        document.querySelector("#root") || (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
    ) {
        techs.push("React")
    }

    //Vue
    if (
        document.querySelector("[data-v-app]") || (window as any).__VUE__
    ) {
        techs.push("Vue");
    }

    //Angular
    if (
        document.querySelector("[ng-version]") || (window as any).ng
    ) {
        techs.push("Angular")
    }

    //Next
    if (
        document.querySelector("#__next")
    ) {
        techs.push("Next.js");
    }

    //Tailwind
    const hasTailwind =
        [...document.querySelectorAll("*")].some((el) => el.className?.toString().includes("bg-"));
    if (hasTailwind)
        techs.push("Tailwind");

    return techs;
}