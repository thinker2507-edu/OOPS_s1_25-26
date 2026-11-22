import React from "../lib/react.js";
import { Field, Button } from "./ui.js";
import { DEFAULT_PREFERENCES } from "../lib/accessibility.js";
const GROUPS = [
  {
    title: "Display",
    choices: [["contrast", "High contrast", "Increase the difference between text, controls and backgrounds in either theme."]]
  },
  {
    title: "Reading",
    choices: [
      ["large", "Larger text", "Increase interface text size without changing your browser zoom."],
      ["readableSpacing", "Comfortable reading", "Add space between lines, letters and words."],
      ["underlineLinks", "Underline links", "Make links identifiable without relying on color."],
    ]
  },
  {
    title: "Interaction",
    choices: [
      ["motion", "Reduce motion", "Remove nonessential animation and smooth scrolling. Your device's reduced-motion preference is also respected."],
      ["largeTargets", "Larger click targets", "Give buttons, form controls and navigation links more room for pointer and touch input."],
      ["strongFocus", "Extra-visible keyboard focus", "Use a stronger outline to show which control will respond to the keyboard."],
    ]
  },
];
function Accessibility({ options, setOptions, resolvedTheme }) {
  return <div className="access-options">
    <p className="description">
      Choose what makes the workspace easier to use. These preferences also apply to sign-in and are remembered when browser storage is available.
    </p>
    {GROUPS.map((group) => <fieldset
      className="preference-group"
      key={group.title}
    >
      <legend>
        {group.title}
      </legend>
      {group.title === "Display" && <Field
        label="Color theme"
        name="theme"
        value={options.theme}
        onChange={(event) => setOptions({
          ...options,
          theme: event.target.value
        })}
        options={[{
          value: "system",
          label: "Use device setting"
        }, {
          value: "light",
          label: "Light"
        }, {
          value: "dark",
          label: "Dark"
        }]}
        help={"Currently using " + resolvedTheme + " mode. Light and Dark are also available in the quick controls."}
      />}
      <div className="preference-grid">
        {group.choices.map(([key, label, description]) => <div
          className="preference-row"
          key={key}
        >
          <label className="check">
            <input
              type="checkbox"
              name={key}
              checked={options[key]}
              aria-describedby={"preference-" + key}
              onChange={(event) => setOptions({
                ...options,
                [key]: event.target.checked
              })}
            />
            <span>
              {label}
            </span>
          </label>
          <p
            className="help"
            id={"preference-" + key}
          >
            {description}
          </p>
        </div>)}
      </div>
    </fieldset>)}
    <div className="preference-footer">
      <Button onClick={() => setOptions({ ...DEFAULT_PREFERENCES })}>
        Reset accessibility preferences
      </Button>
      <span className="help">
        Reset returns to your device theme and default settings.
      </span>
    </div>
    <p className="help">
      Use Tab and Shift+Tab to navigate, Enter or Space to activate, and use browser Back/Forward to move between pages. A skip link appears when you press Tab.
    </p>
  </div>;
}
export { Accessibility };
