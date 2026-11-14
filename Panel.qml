import QtQuick
import QtQuick.Controls

// The panel beside the page: how the story stands, a field to steer it, a
// field to ask its author, the branch and sequel buttons, and what the
// reader knows of the world so far.
//
// A panel is any QML item. It sees what Omabook's own views see (`backend`,
// `reader`, `theme`), and what the script set with omabook.ui.set, as
// backend.scripts.data["<plugin>"]. It holds no logic of its own: it draws
// the one value the script hands it ("view", built in lib/status.js) and
// tells the script what was clicked.
//
// The words here are plain English and not translated: a plugin has no
// translation catalog, so qsTr would find nothing.
Flickable {
    id: panel

    // This plugin's values. A plugin's name is its folder's, which is
    // chosen when it is installed, so the panel looks for the value that
    // says it is Storyteller's instead of assuming a name.
    readonly property string plugin: {
        const all = backend.scripts.data
        for (const name in all)
            if (all[name] && all[name].view && all[name].view.storyteller)
                return name
        return ""
    }
    readonly property var view: plugin !== "" ? backend.scripts.data[plugin].view : ({})
    // Omabook shows this panel only beside books the plugin made (`when:
    // "generated"` in main.js). The script knows which book is open from
    // the reader's events; while the two disagree (a book just opened),
    // the panel shows nothing of it.
    readonly property bool mine: !!view.mine && view.book === reader.bookId
    readonly property bool busy: view.state === "running"

    readonly property color ink: theme.foreground
    readonly property color faint: theme.colors.muted
    readonly property color line: theme.colors.selection

    // What the last thing asked of the script came to, when it could not
    // be done: shown under the state line until something else is asked.
    property string problem: ""
    property int asked: -1

    // Asks the script for something. `request` answers at once with a
    // number and later, through the `answered` signal, with what came of
    // it: the result, or why not. A chapter takes minutes; the panel
    // stays usable meanwhile.
    function tell(action, text) {
        problem = ""
        asked = backend.scripts.request(plugin, "panel", [action, reader.bookId, text || ""])
    }

    Connections {
        target: backend.scripts
        function onAnswered(id, result, error) {
            if (id !== panel.asked) return
            panel.asked = -1
            panel.problem = error || ""
        }
    }

    contentWidth: width
    contentHeight: column.height + 24
    clip: true
    boundsBehavior: Flickable.StopAtBounds

    component Heading: Label {
        width: column.width
        color: panel.faint
        font.pixelSize: 11
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 1
        topPadding: 10
    }

    component Words: Label {
        width: column.width
        color: panel.ink
        wrapMode: Text.Wrap
        lineHeight: 1.25
    }

    component Field: TextField {
        width: column.width
        color: panel.ink
        placeholderTextColor: panel.faint
        selectByMouse: true
        leftPadding: 8
        rightPadding: 8
        background: Rectangle {
            color: "transparent"
            border.color: parent.activeFocus ? theme.accent : panel.line
            border.width: 1
            radius: theme.radius
        }
        // Escape gives the keyboard back to the page.
        Keys.onEscapePressed: focus = false
    }

    component Action: Button {
        id: action
        flat: true
        padding: 8
        contentItem: Label {
            text: action.text
            color: action.enabled ? panel.ink : panel.faint
            horizontalAlignment: Text.AlignHCenter
        }
        background: Rectangle {
            color: action.down ? panel.line : "transparent"
            border.color: action.activeFocus ? theme.accent : panel.line
            border.width: 1
            radius: theme.radius
        }
    }

    Column {
        id: column
        x: 14
        y: 12
        width: panel.width - 28
        spacing: 8

        Label {
            text: "Storyteller"
            color: panel.ink
            font.bold: true
        }

        Column {
            visible: panel.mine
            width: parent.width
            spacing: 8

            Words {
                text: view.title || ""
                font.pixelSize: 16
            }
            Words {
                visible: text !== ""
                color: panel.faint
                text: view.lineage || ""
            }

            // The quiet state: one line, with a mark that breathes while a
            // chapter is being written.
            Row {
                width: parent.width
                spacing: 8
                Rectangle {
                    id: mark
                    width: 8
                    height: 8
                    radius: 4
                    anchors.top: parent.top
                    anchors.topMargin: 5
                    color: view.state === "failed" ? theme.colors.red : panel.busy ? theme.accent : panel.line
                    SequentialAnimation on opacity {
                        running: panel.busy
                        loops: Animation.Infinite
                        alwaysRunToEnd: true
                        NumberAnimation { to: 0.3; duration: 900 }
                        NumberAnimation { to: 1; duration: 900 }
                    }
                }
                Words {
                    objectName: "storytellerState"
                    width: parent.width - mark.width - parent.spacing
                    text: view.line || ""
                }
            }
            Words {
                objectName: "storytellerProblem"
                visible: text !== ""
                color: theme.colors.red
                text: panel.problem
            }
            Words {
                visible: text !== ""
                color: panel.faint
                font.italic: true
                text: view.note || ""
            }

            Heading { text: "Steer the story" }
            Field {
                id: steerField
                objectName: "storytellerSteer"
                enabled: !view.ended
                placeholderText: view.ended ? "The story has ended" : "Who to follow, what should happen…"
                onAccepted: {
                    if (text.trim() === "") return
                    panel.tell("steer", text)
                    text = ""
                    focus = false
                }
            }
            Repeater {
                model: view.steering || []
                Words {
                    required property string modelData
                    color: panel.faint
                    text: "“" + modelData + "”"
                }
            }

            Heading { text: "Ask the author" }
            Field {
                id: askField
                objectName: "storytellerAsk"
                placeholderText: "A question about the story so far"
                onAccepted: {
                    if (text.trim() === "") return
                    panel.tell(spoilers.checked ? "askSpoilers" : "ask", text)
                    text = ""
                    focus = false
                }
            }
            CheckBox {
                id: spoilers
                text: "Spoilers are fine"
                padding: 0
                contentItem: Label {
                    text: spoilers.text
                    color: panel.faint
                    leftPadding: spoilers.indicator.width + 6
                    verticalAlignment: Text.AlignVCenter
                }
            }
            Column {
                visible: !!view.answer
                width: parent.width
                spacing: 4
                Words {
                    color: panel.faint
                    text: view.answer ? view.answer.question : ""
                }
                Words {
                    objectName: "storytellerAnswer"
                    text: view.answer ? view.answer.text : ""
                }
            }

            Flow {
                width: parent.width
                spacing: 8
                topPadding: 6
                Action {
                    objectName: "storytellerNext"
                    visible: !view.ended
                    enabled: !panel.busy
                    text: view.state === "failed" || view.state === "interrupted" ? "Try again" : "Next chapter now"
                    onClicked: panel.tell("next")
                }
                // These two ask a question first, in Omabook's own dialog,
                // by running the plugin's commands. A command is named
                // with its plugin, "<plugin>:<id>": a bare id only works
                // while no other plugin has one of the same name.
                Action {
                    objectName: "storytellerBranch"
                    text: "Branch from here"
                    onClicked: backend.scripts.run(panel.plugin + ":story-branch", reader.bookId)
                }
                Action {
                    objectName: "storytellerSequel"
                    visible: !!view.ended
                    text: "Write a sequel"
                    onClicked: backend.scripts.run(panel.plugin + ":story-sequel", reader.bookId)
                }
            }

            Heading { text: "What you know so far" }
            Words {
                visible: (view.known || []).length === 0
                color: panel.faint
                text: "Nothing yet. It fills in as you finish chapters."
            }
            Repeater {
                model: view.known || []
                Column {
                    id: thing
                    required property var modelData
                    width: column.width
                    spacing: 1
                    Row {
                        spacing: 6
                        Label {
                            text: thing.modelData.name
                            color: panel.ink
                            font.bold: true
                        }
                        Label {
                            text: thing.modelData.kind
                            color: panel.faint
                            font.pixelSize: 11
                            anchors.baseline: parent.children[0].baseline
                        }
                    }
                    Words {
                        color: panel.faint
                        text: thing.modelData.summary
                    }
                }
            }
            // The whole of it, in Omabook's own graph view: the reader's
            // graph of this story, opened beside the page.
            Action {
                objectName: "storytellerGraph"
                visible: (view.known || []).length > 0
                text: "Show as a graph"
                onClicked: panel.tell("world")
            }
        }
    }
}
