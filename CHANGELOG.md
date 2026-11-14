# Changelog

## 3.5.4 - Interface Polish

- **Calmer Interface**: Removed decorative gradients, radial color washes, colored glows, and frosted-glass blur from buttons, cards, progress bars, and the completion notification. Buttons and progress bars now use solid brand colors, and the error color is toned down.
- **Readable Labels**: Section labels such as Active Profile, Media Inspector, and Quick Shortcuts no longer use uppercase with wide letter spacing. Headings use lighter weights (500 to 600 instead of 700 to 800), and small text no longer uses negative letter spacing.
- **Real Font Weights**: Bundled the variable Inter font so weights 500 and 600 render correctly instead of falling back to Regular or Bold.
- **Quieter Selection States**: The selected sidebar module, Settings tabs, and theme selector use a neutral raised surface instead of an indigo tint and border. Settings section icons share one color.
- **Clearer Status**: The workspace status is a small colored dot with Ready, Processing, or Stopping in place of an uppercase pill. The inspector shows Idle or Running with elapsed time instead of STANDBY or LIVE. Active Profile options are neutral, with enabled options shown in brighter text.
- **Simpler Motion**: The completion notification fades and rises without scaling. Page transitions share one easing curve, and catch-all `transition: all` rules now animate only color and background properties.
