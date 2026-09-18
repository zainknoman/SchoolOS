import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/theme/accent_controller.dart';

void main() {
  test('only a "mother" relationship selects the magenta accent', () {
    expect(GuardianAccent.fromRelationship('mother'), GuardianAccent.magenta);
    expect(GuardianAccent.fromRelationship(' Mother '), GuardianAccent.magenta);
    expect(GuardianAccent.fromRelationship('father'), GuardianAccent.blue);
    expect(GuardianAccent.fromRelationship('guardian'), GuardianAccent.blue);
    expect(GuardianAccent.fromRelationship(null), GuardianAccent.blue);
  });

  test('AccentController notifies on change, not on a no-op, and reset() returns to blue', () {
    final controller = AccentController();
    var notifications = 0;
    controller.addListener(() => notifications++);

    controller.setAccent(GuardianAccent.blue);
    expect(notifications, 0);

    controller.setAccent(GuardianAccent.magenta);
    expect(notifications, 1);

    controller.reset();
    expect(controller.accent, GuardianAccent.blue);
    expect(notifications, 2);
  });
}
