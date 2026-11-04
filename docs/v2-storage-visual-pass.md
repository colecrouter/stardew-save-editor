# Storage visual pass

Storage keeps all matching containers and their contents visible in the browser;
there is no collapsed chest picker or separate transfer mode. Search still spans
all locations, and location filtering applies when search is empty. Container
names retain location/tile context, alongside occupied capacity and type controls.

The page uses shared fields, checkbox, buttons and icon alerts. Slots match the
Inventory treatment, including saved quality badges and outlined quantities.
Bulk selection and quality controls retain their existing captured command scope.
Clear selection and guidance reserve their place before selecting items so they
do not push chest targets away from the pointer.

Desktop gives the chest list and inspector independent scroll areas. The inspector
column is reserved before selecting an item; switching item types cannot resize
or reflow the chest grid. Wide displays can show two container columns. Narrow
layouts use document scrolling, with explicit Selected item/Back to containers
anchors; selection and dragging never force navigation.

Touch autoscroll uses each scroll pane's visible edges, clipped to the viewport.
It tries enclosing scroll areas at their own edges before falling back to page
scrolling. Cancellation and view destruction still stop animation frames without
publishing a move. A dedicated Storage regression covers both nested-pane edges,
page-scroll isolation, cancellation and unchanged save/history.

Validation includes populated and searched storage, multi-selection/quality,
container conversions, native/touch transfers and Undo. Desktop and phone captures
are supplied for owner review under #218; final release/device validation remains
under #219. Original save parsing and inventory ownership contracts are unchanged.
