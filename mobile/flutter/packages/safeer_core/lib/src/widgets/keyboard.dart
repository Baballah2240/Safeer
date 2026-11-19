import 'package:flutter/material.dart';

/// Typing helpers shared by both apps (the Flutter counterpart of a React Native keyboard
/// controller): tap outside a field or drag a form to close the keyboard, keep the focused
/// field and the main button above the keyboard, and keep forms a readable width on tablets.

/// Wrap the whole app: a tap on empty space closes the keyboard. Taps on fields and buttons
/// still go to them, because the innermost gesture wins.
class KeyboardDismissOnTap extends StatelessWidget {
  const KeyboardDismissOnTap({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => GestureDetector(behavior: HitTestBehavior.translucent, excludeFromSemantics: true, onTap: () => FocusManager.instance.primaryFocus?.unfocus(), child: child);
}

/// Room kept between the focused field and the keyboard (or a bottom button bar), so the
/// field, its error text and the next field stay visible while typing.
const keyboardScrollPadding = EdgeInsets.fromLTRB(20, 20, 20, 120);

/// A scrolling form: closes the keyboard on drag, centres the content and limits it to a
/// readable width on tablets and in landscape.
class FormBody extends StatelessWidget {
  const FormBody({super.key, required this.children, this.padding = const EdgeInsets.all(16), this.maxWidth = 560});
  final List<Widget> children;
  final EdgeInsets padding;
  final double maxWidth;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
    padding: padding,
    child: Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
      ),
    ),
  );
}

/// Content of a bottom sheet with a text field: sits above the keyboard and scrolls when the
/// keyboard leaves too little room (short or landscape screens).
class KeyboardSheet extends StatelessWidget {
  const KeyboardSheet({super.key, required this.children, this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 16)});
  final List<Widget> children;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: padding,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        ),
      ),
    ),
  );
}
