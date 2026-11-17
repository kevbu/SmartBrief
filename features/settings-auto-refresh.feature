@e2e @settings
Feature: Auto-Refresh mode in Settings
  As the single SmartBrief user
  I want to choose when SmartBrief refreshes on its own
  So that a fresh briefing is ready without tapping refresh, and only when I opted in

  Background:
    Given the e2e server runs with SMARTBRIEF_SCHEDULER=off on a fresh database
    And I am on the Settings page

  @smoke
  Scenario: HP-1 - Manual is the default and shows no schedule controls
    Then the "Refresh mode" radiogroup offers "Manual", "Interval" and "Daily"
    And "Manual" is checked
    And the Auto-Refresh section says "Only when you tap refresh."
    And no interval options are visible
    And no "Every day at" time input is visible
    And the hint "Each refresh uses Claude." is not shown

  Scenario Outline: HP-2 - Interval mode shows the interval options and the cost hint
    When I choose the "Interval" refresh mode
    Then "Interval" is checked
    And the interval options "30 min", "1 hour", "2 hours", "4 hours" and "6 hours" are visible
    When I choose the interval "<option>"
    Then "<option>" is pressed and no other interval option is pressed
    And the Auto-Refresh section says "Every <phrase> while your computer is on."
    And the hint "Each refresh uses Claude." is shown

    Examples:
      | option  | phrase  |
      | 30 min  | 30 min  |
      | 1 hour  | 1 hour  |
      | 2 hours | 2 hours |
      | 4 hours | 4 hours |
      | 6 hours | 6 hours |

  Scenario: HP-3 - Daily mode shows a labelled time input prefilled with 07:00
    When I choose the "Daily" refresh mode
    Then "Daily" is checked
    And a time input labelled "Every day at" shows "07:00"
    And the Auto-Refresh section says "Every day at 07:00. If your computer is asleep then, it runs as soon as it wakes."
    And the hint "Each refresh uses Claude." is shown
    And no interval options are visible

  Scenario: HP-4 - Daily time survives save and reload
    When I choose the "Daily" refresh mode
    And I set the time labelled "Every day at" to "07:30"
    And I save my preferences
    And I reload the Settings page
    Then "Daily" is checked
    And the time input labelled "Every day at" shows "07:30"
    And the Auto-Refresh section says "Every day at 07:30. If your computer is asleep then, it runs as soon as it wakes."

  Scenario: EC-1 - Clearing the daily time keeps the last valid time and the save still succeeds
    When I choose the "Daily" refresh mode
    And I set the time labelled "Every day at" to "08:15"
    And I clear the time labelled "Every day at"
    Then the time input labelled "Every day at" still shows "08:15"
    When I save my preferences
    Then the save succeeds with refresh mode "daily" and time "08:15"
