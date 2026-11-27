# Explanatory comments and readability

When writing or changing logic, explain each meaningful step's intended outcome in
nearby comments. Include assumptions, representations, branch meanings, and reasons
for choices where relevant. Simple expressions may still need explanation: brevity
of syntax does not establish obviousness of intent.

Write comments so a reader can compare the intended behavior with the implementation
and spot disagreements. Explain what we intend to accomplish rather than merely
translating the expression into English.

Preserve explanatory comments and navigational comments. Update them when behavior
changes. Do not remove them solely because you consider the code self-explanatory.

Before finishing, read the changed code's comments as a narrative: can the owner
recover the purpose and progression without mentally executing every expression?
Then check that the implementation agrees with that narrative.

Match the explanatory density of the supplied examples. Do not require a comment on
every line or invent reasons you cannot establish.

Write Svelte markup with generous line breaks between elements, control-flow blocks,
attributes and content. Let Oxfmt normalize it; do not compact the source into chains
of adjacent elements. Follow CONTRIBUTING.md for tooling and validation.

# Test validation

Run the full `npm test` suite before handing off changes to shared editor behavior,
including routing, import/export, and shared controls. `npm run check` covers lint
and type checking, including test types. `npm test` executes the tests.

Report the commands you ran and their results. Use a pull request for changes to
`main` and wait for the required checks and review before merging. Follow CI after
pushing a fix, resolve failures in scope, and report any outstanding checks or
blockers before handoff.
