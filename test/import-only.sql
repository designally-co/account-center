-- What runs between the two snapshots: the one-time import and the checks. None may change HR.
select account.import_from_hr();
select account.can_user('00000000-0000-0000-0000-00000000000a', 'account_center.view');
select account.can_email('ann@example.com', 'account_center.view');
select account.me_by_user('00000000-0000-0000-0000-00000000000a');
select account.login_state('00000000-0000-0000-0000-00000000000a');
