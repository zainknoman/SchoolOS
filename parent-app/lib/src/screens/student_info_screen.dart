import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_header.dart';
import '../widgets/parent_ui.dart';

/// "Student information" — opened from the eye button beside the Home child pills and from More.
/// School-record fields (name, date of birth, class, GR number, guardians) are read-only; the
/// parent can edit contact details, current address, medical notes and emergency contacts, which
/// is exactly the subset `PATCH /me/children/:id` accepts.
class StudentInfoScreen extends StatefulWidget {
  const StudentInfoScreen({
    super.key,
    required this.accessToken,
    required this.api,
    required this.children,
    this.initialChildId,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;
  final String? initialChildId;

  @override
  State<StudentInfoScreen> createState() => _StudentInfoScreenState();
}

class _ContactControllers {
  _ContactControllers({String name = '', String relationship = '', String phone = ''})
    : name = TextEditingController(text: name),
      relationship = TextEditingController(text: relationship),
      phone = TextEditingController(text: phone);

  final TextEditingController name;
  final TextEditingController relationship;
  final TextEditingController phone;

  void dispose() {
    name.dispose();
    relationship.dispose();
    phone.dispose();
  }
}

class _StudentInfoScreenState extends State<StudentInfoScreen> {
  static const _maxContacts = 5;

  late String _selectedChildId = widget.children.any((c) => c.id == widget.initialChildId)
      ? widget.initialChildId!
      : widget.children.first.id;
  StudentDetail? _detail;
  String? _error;
  bool _editing = false;
  bool _saving = false;

  final _mobile = TextEditingController();
  final _email = TextEditingController();
  final _line1 = TextEditingController();
  final _area = TextEditingController();
  final _city = TextEditingController();
  final _allergies = TextEditingController();
  final _conditions = TextEditingController();
  final _medication = TextEditingController();
  final List<_ContactControllers> _contacts = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [_mobile, _email, _line1, _area, _city, _allergies, _conditions, _medication]) {
      c.dispose();
    }
    for (final c in _contacts) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _detail = null;
      _error = null;
      _editing = false;
    });
    try {
      final detail = await widget.api.studentDetail(widget.accessToken, _selectedChildId);
      if (!mounted) return;
      setState(() => _detail = detail);
      _fillForm(detail);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _fillForm(StudentDetail d) {
    _mobile.text = d.studentMobile ?? '';
    _email.text = d.studentEmail ?? '';
    _line1.text = d.addressLine1 ?? '';
    _area.text = d.addressArea ?? '';
    _city.text = d.addressCity ?? '';
    _allergies.text = d.allergies ?? '';
    _conditions.text = d.medicalConditions ?? '';
    _medication.text = d.medicationNotes ?? '';
    for (final c in _contacts) {
      c.dispose();
    }
    _contacts
      ..clear()
      ..addAll(
        d.emergencyContacts.map(
          (c) => _ContactControllers(name: c.name, relationship: c.relationship, phone: c.phone),
        ),
      );
  }

  Future<void> _save() async {
    final contacts = <EmergencyContactInfo>[];
    for (final c in _contacts) {
      final name = c.name.text.trim();
      final relationship = c.relationship.text.trim();
      final phone = c.phone.text.trim();
      if (name.isEmpty && relationship.isEmpty && phone.isEmpty) continue;
      if (name.isEmpty || relationship.isEmpty || phone.length < 3) {
        setState(() => _error = 'Each emergency contact needs a name, relationship and phone number.');
        return;
      }
      contacts.add(EmergencyContactInfo(name: name, relationship: relationship, phone: phone));
    }
    final line1 = _line1.text.trim();
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await widget.api.updateStudent(widget.accessToken, _selectedChildId, {
        'studentMobile': _mobile.text.trim(),
        if (_email.text.trim().isNotEmpty) 'studentEmail': _email.text.trim(),
        if (line1.isNotEmpty)
          'currentAddress': {
            'line1': line1,
            if (_area.text.trim().isNotEmpty) 'area': _area.text.trim(),
            if (_city.text.trim().isNotEmpty) 'city': _city.text.trim(),
          },
        'allergies': _allergies.text.trim(),
        'medicalConditions': _conditions.text.trim(),
        'medicationNotes': _medication.text.trim(),
        'emergencyContacts': contacts.map((c) => c.toJson()).toList(),
      });
      if (!mounted) return;
      setState(() {
        _detail = updated;
        _editing = false;
      });
      _fillForm(updated);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Information updated.')));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Student information',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontSize: 16),
        ),
        backgroundColor: Theme.of(context).colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        shape: Border(bottom: BorderSide(color: hairline(context))),
        actions: [
          if (detail != null && !_editing)
            TextButton.icon(
              key: const Key('studentInfoEdit'),
              onPressed: () => setState(() => _editing = true),
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: const Text('Edit'),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        children: [
          if (widget.children.length > 1) ...[
            const FieldLabel('Child'),
            DropdownButtonFormField<String>(
              key: const Key('studentInfoChildDropdown'),
              initialValue: _selectedChildId,
              isDense: true,
              decoration: fieldDecoration(),
              items: widget.children
                  .map(
                    (c) => DropdownMenuItem(
                      value: c.id,
                      child: Text('${c.name} — ${c.schoolClass} ${c.section}'),
                    ),
                  )
                  .toList(),
              onChanged: _saving
                  ? null
                  : (value) {
                      if (value == null) return;
                      setState(() => _selectedChildId = value);
                      _load();
                    },
            ),
            const SizedBox(height: 16),
          ],
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, key: const Key('studentInfoError'), style: TextStyle(color: tones.absent)),
            ),
          if (detail == null && _error == null) const Center(child: CircularProgressIndicator()),
          if (detail != null) ...[
            _summaryCard(context, detail),
            const SizedBox(height: 18),
            const SectionLabel('School record'),
            _readOnlyCard(context, detail),
            if (detail.guardians.isNotEmpty) ...[
              const SizedBox(height: 18),
              const SectionLabel('Guardians'),
              _guardiansCard(context, detail),
            ],
            const SizedBox(height: 18),
            const SectionLabel('Contact & address'),
            _editing ? _contactForm() : _contactView(context, detail),
            const SizedBox(height: 18),
            const SectionLabel('Medical notes'),
            _editing ? _medicalForm() : _medicalView(context, detail),
            const SizedBox(height: 18),
            const SectionLabel('Emergency contacts'),
            _editing ? _contactsForm(context) : _contactsView(context, detail),
            if (_editing) ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('studentInfoCancel'),
                      onPressed: _saving
                          ? null
                          : () {
                              _fillForm(detail);
                              setState(() {
                                _editing = false;
                                _error = null;
                              });
                            },
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      key: const Key('studentInfoSave'),
                      onPressed: _saving ? null : _save,
                      child: Text(_saving ? 'Saving…' : 'Save changes'),
                    ),
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 16),
              Text(
                'To change your child’s name, date of birth or class, please contact the school office.',
                style: TextStyle(fontSize: 11.5, color: tones.muted),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _summaryCard(BuildContext context, StudentDetail d) {
    final tones = Tones.of(context);
    final classLabel = [d.schoolClass, d.section].whereType<String>().join(' ');
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Tones.tint(Theme.of(context).colorScheme.primary),
                shape: BoxShape.circle,
              ),
              child: Text(
                initialsOf(d.name),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 2),
                  Text(
                    [classLabel, d.campus].where((e) => e != null && e.isNotEmpty).join(' · '),
                    style: TextStyle(fontSize: 12, color: tones.muted),
                  ),
                  const SizedBox(height: 2),
                  Text('GR ${d.grNumber}', style: TextStyle(fontSize: 12, color: tones.muted, fontFamily: 'monospace')),
                ],
              ),
            ),
            StatusPill(label: d.status.toLowerCase(), color: StatusPill.colorFor(context, 'approved')),
          ],
        ),
      ),
    );
  }

  Widget _kv(BuildContext context, String label, String? value) {
    final tones = Tones.of(context);
    return GroupedRow(
      child: Row(
        children: [
          Expanded(flex: 4, child: Text(label, style: TextStyle(fontSize: 12.5, color: tones.muted))),
          Expanded(
            flex: 6,
            child: Text(
              (value == null || value.isEmpty) ? '—' : value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  String? _titleCase(String? v) =>
      v == null ? null : v[0].toUpperCase() + v.substring(1).toLowerCase().replaceAll('_', ' ');

  Widget _readOnlyCard(BuildContext context, StudentDetail d) => GroupedCard(
    children: [
      _kv(context, 'Date of birth', d.dateOfBirth),
      _kv(context, 'Gender', _titleCase(d.gender)),
      _kv(context, 'Campus', d.campus),
      _kv(context, 'Class', [d.schoolClass, d.section].whereType<String>().join(' ')),
      _kv(context, 'Roll number', d.rollNumber),
      _kv(context, 'Admission date', d.admissionDate),
    ],
  );

  Widget _guardiansCard(BuildContext context, StudentDetail d) => GroupedCard(
    children: [
      for (final g in d.guardians)
        GroupedRow(
          child: Row(
            children: [
              InitialsAvatar(g.name, neutral: true),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(g.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    Text(
                      [_titleCase(g.relationship), g.phone].where((e) => e != null && e.isNotEmpty).join(' · '),
                      style: TextStyle(fontSize: 12, color: Tones.of(context).muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
    ],
  );

  Widget _contactView(BuildContext context, StudentDetail d) => GroupedCard(
    children: [
      _kv(context, 'Student mobile', d.studentMobile),
      _kv(context, 'Student email', d.studentEmail),
      _kv(context, 'Address', [d.addressLine1, d.addressArea, d.addressCity].where((e) => e != null && e.isNotEmpty).join(', ')),
    ],
  );

  Widget _medicalView(BuildContext context, StudentDetail d) => GroupedCard(
    children: [
      _kv(context, 'Blood group', d.bloodGroup?.replaceAll('_POS', '+').replaceAll('_NEG', '−')),
      _kv(context, 'Allergies', d.allergies),
      _kv(context, 'Conditions', d.medicalConditions),
      _kv(context, 'Medication', d.medicationNotes),
    ],
  );

  Widget _contactsView(BuildContext context, StudentDetail d) {
    if (d.emergencyContacts.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(left: 2),
        child: Text('No emergency contacts on record.', style: TextStyle(color: Tones.of(context).muted)),
      );
    }
    return GroupedCard(
      children: [
        for (final c in d.emergencyContacts)
          GroupedRow(
            child: Row(
              children: [
                const IconBadge(Icons.phone_outlined, neutral: true),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                      Text(c.relationship, style: TextStyle(fontSize: 12, color: Tones.of(context).muted)),
                    ],
                  ),
                ),
                Text(c.phone, style: const TextStyle(fontSize: 12.5, fontFamily: 'monospace')),
              ],
            ),
          ),
      ],
    );
  }

  Widget _field(String label, TextEditingController controller, {Key? key, TextInputType? type, int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FieldLabel(label),
          TextField(key: key, controller: controller, keyboardType: type, maxLines: maxLines, decoration: fieldDecoration()),
        ],
      ),
    );
  }

  Widget _formCard(List<Widget> children) => Card(
    margin: EdgeInsets.zero,
    child: Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 4), child: Column(children: children)),
  );

  Widget _contactForm() => _formCard([
    _field('Student mobile', _mobile, key: const Key('studentMobileField'), type: TextInputType.phone),
    _field('Student email', _email, key: const Key('studentEmailField'), type: TextInputType.emailAddress),
    _field('Address', _line1, key: const Key('studentAddressField')),
    _field('Area', _area),
    _field('City', _city),
  ]);

  Widget _medicalForm() => _formCard([
    _field('Allergies', _allergies, key: const Key('studentAllergiesField'), maxLines: 2),
    _field('Medical conditions', _conditions, maxLines: 2),
    _field('Medication notes', _medication, maxLines: 2),
  ]);

  Widget _contactsForm(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < _contacts.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _formCard([
              Row(
                children: [
                  Expanded(child: Text('Contact ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700))),
                  IconButton(
                    key: Key('removeContact$i'),
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Remove contact',
                    icon: const Icon(Icons.delete_outline, size: 18),
                    onPressed: () => setState(() => _contacts.removeAt(i).dispose()),
                  ),
                ],
              ),
              _field('Name', _contacts[i].name),
              _field('Relationship', _contacts[i].relationship),
              _field('Phone', _contacts[i].phone, type: TextInputType.phone),
            ]),
          ),
        if (_contacts.length < _maxContacts)
          OutlinedButton.icon(
            key: const Key('addEmergencyContact'),
            onPressed: () => setState(() => _contacts.add(_ContactControllers())),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add emergency contact'),
          ),
      ],
    );
  }
}
