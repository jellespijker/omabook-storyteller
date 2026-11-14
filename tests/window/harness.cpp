// The Storyteller plugin in Omabook's real window (qrc:/Main.qml), with no
// display: started with QT_QPA_PLATFORM=offscreen, the plugin copied into a
// scratch plugin folder, and the stand-in model of tests/stub_ai.py. It is
// put together the way Omabook's own window tests are (the Desk of its
// tests/ui_tests.cpp), which is why it links Omabook's code; see
// CMakeLists.txt beside this file for how to build and run it.
//
// It starts a story from its key, types in the panel's steer field (which
// must not set off the reader's single-key shortcuts), pages on until the
// next chapter arrives (the reader must keep its place), opens the graph
// view, asks the author, branches, opens a book by a person (no panel, no
// story commands), and ends by requiring that QML warned of nothing.
// STORYTELLER is the plugin's folder; SHOTS a folder for screenshots.
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QQmlContext>
#include <QQmlEngine>
#include <QQuickItem>
#include <QQuickStyle>
#include <QQuickWindow>
#include <QTemporaryDir>
#include <QTimer>
#include <QtTest>
#include <optional>

#include "ai.h"
#include "assistant.h"
#include "backend.h"
#include "customization.h"
#include "interface.h"
#include "librarian.h"
#include "library.h"
#include "manual.h"
#include "reader.h"
#include "scriptplugins.h"
#include "settings.h"
#include "theme.h"
#include "translator.h"

namespace {

bool write(const QString &path, const QByteArray &contents) {
    QDir().mkpath(QFileInfo(path).absolutePath());
    QFile file(path);
    return file.open(QIODevice::WriteOnly) && file.write(contents) == contents.size();
}

void copyTree(const QString &from, const QString &to) {
    QDir().mkpath(to);
    for (const QFileInfo &entry : QDir(from).entryInfoList(QDir::AllEntries | QDir::NoDotAndDotDot)) {
        if (entry.fileName() == "data" || entry.fileName() == "tests" || entry.fileName().startsWith('.'))
            continue;
        if (entry.isDir())
            copyTree(entry.filePath(), to + "/" + entry.fileName());
        else
            QFile::copy(entry.filePath(), to + "/" + entry.fileName());
    }
}

class NoPicker : public FilePicker {
public:
    void pick(Purpose, const QString &) override {}
};

struct Desk {
    QTemporaryDir dir;
    NoPicker picker;
    std::optional<Translator> translator;
    std::optional<Theme> theme;
    std::optional<Settings> settings;
    std::optional<Backend> backend;
    std::optional<Reader> reader;
    std::optional<Assistant> assistant;
    std::optional<AiAgent> aiAgent;
    std::optional<Customization> custom;
    std::optional<Look> look;
    std::optional<Librarian> librarian;
    std::optional<Manual> manual;
    std::optional<QQmlEngine> engine;
    std::optional<Interface> interface;
    QStringList warnings;
    QQuickWindow *window = nullptr;
    QString shots;

    Desk(const QString &plugin, const QString &stub, const QString &shotFolder) : shots(shotFolder) {
        qputenv("XDG_CACHE_HOME", dir.filePath("cache").toUtf8());
        qputenv("STUB_DIR", dir.filePath("stub").toUtf8());
        QDir().mkpath(dir.filePath("stub"));
        write(dir.filePath("language"), "en\n");
        copyTree(plugin, dir.filePath("plugins/storyteller"));
        write(dir.filePath("plugins/storyteller/data/settings.json"), R"({"chapter_words": 900, "chapters": 5})");
        translator.emplace(dir.filePath("language"));
        QCoreApplication::installTranslator(&*translator);
        theme.emplace(dir.filePath("desktop"));
        custom.emplace(dir.filePath("custom"));
        look.emplace(&*theme, &*custom);
        settings.emplace(dir.filePath("config.json"));
        settings->setLibraryPath(dir.filePath("Library"));
        settings->setAiProvider("command");
        settings->setAiCommand("python3 " + stub);
        settings->setPluginEnabled("folder:storyteller", true);
        auto makeAi = [this](QString *why) { return makeAiProvider(*settings, why, dir.filePath("omarchy/defaults/agent")); };
        backend.emplace(&*settings, &picker, nullptr, makeAi, [](QObject *) { return QList<MetadataSource *>{}; }, dir.filePath("plugins"), "-");
        reader.emplace(&*backend, QString());
        assistant.emplace(&*reader, makeAi);
        aiAgent.emplace(&*settings, dir.filePath("omarchy/defaults/agent"));
        librarian.emplace(&*backend, &*settings, &*custom, [this] { return look->colors(); });
        settings->setTour("done");
        settings->setNewsSeen(OMABOOK_VERSION);
        manual.emplace(&*settings, &*custom);
        const auto followPlugins = [this] { custom->setPlugins(backend->scripts()->commands(), backend->scripts()->panels()); };
        QObject::connect(backend->scripts(), &ScriptPlugins::changed, &*custom, followPlugins);
        followPlugins();
    }
    ~Desk() {
        interface.reset();
        engine.reset();
        QCoreApplication::removeTranslator(&*translator);
    }

    bool show() {
        engine.emplace();
        QObject::connect(&*engine, &QQmlEngine::warnings, &*engine, [this](const QList<QQmlError> &errors) {
            for (const auto &error : errors)
                warnings << error.toString();
        });
        engine->addImageProvider("book", reader->imageProvider());
        engine->rootContext()->setContextProperty("translator", &*translator);
        engine->rootContext()->setContextProperty("theme", &*look);
        engine->rootContext()->setContextProperty("custom", &*custom);
        engine->rootContext()->setContextProperty("librarian", &*librarian);
        engine->rootContext()->setContextProperty("manual", &*manual);
        engine->rootContext()->setContextProperty("settings", &*settings);
        engine->rootContext()->setContextProperty("backend", &*backend);
        engine->rootContext()->setContextProperty("reader", &*reader);
        engine->rootContext()->setContextProperty("assistant", &*assistant);
        engine->rootContext()->setContextProperty("aiAgent", &*aiAgent);
        engine->rootContext()->setContextProperty("touchscreen", false);
        interface.emplace(&*engine, &*custom);
        QObject::connect(&*interface, &Interface::loaded, &*engine, [this] { window = interface->window(); });
        if (!interface->load())
            return false;
        window = interface->window();
        if (!window || !QTest::qWaitForWindowExposed(window))
            return false;
        window->requestActivate();
        return QTest::qWaitForWindowActive(window);
    }

    QQuickItem *find(const QString &name) const {
        QList<QQuickItem *> items{window->contentItem()};
        // Popups live under the overlay, which is a child of the content item.
        while (!items.isEmpty()) {
            QQuickItem *item = items.takeFirst();
            if (item->objectName() == name)
                return item;
            if (auto *object = item->findChild<QQuickItem *>(name))
                return object;
            items << item->childItems();
        }
        return nullptr;
    }
    QVariant value(const QString &name, const char *property) const {
        if (QObject *object = window->findChild<QObject *>(name))
            return object->property(property);
        QQuickItem *item = find(name);
        return item ? item->property(property) : QVariant();
    }
    void shot(const QString &name) const {
        QTest::qWait(400);
        window->grabWindow().save(shots + "/" + name + ".png");
    }
    void key(Qt::Key key, Qt::KeyboardModifiers modifiers = Qt::NoModifier) { QTest::keyClick(window, key, modifiers); }
    void type(const QString &text) {
        for (const QChar c : text)
            QTest::keyClick(window, c.toLatin1());
    }
    bool click(const QString &name) {
        QQuickItem *item = find(name);
        if (!item || !item->isVisible())
            return false;
        const QPointF centre = item->mapToScene(QPointF(item->width() / 2, item->height() / 2));
        QTest::mouseClick(window, Qt::LeftButton, Qt::NoModifier, centre.toPoint());
        return true;
    }
    QJsonObject view() {
        return QJsonObject::fromVariantMap(backend->scripts()->data().value("storyteller").toMap()).value("view").toObject();
    }
    QList<Book> stories() {
        QList<Book> made;
        for (const Book &book : backend->library()->books())
            if (book.identifiers.value("generated").toString() == "storyteller")
                made << book;
        return made;
    }
    QStringList calls() const {
        QStringList tasks;
        QFile file(dir.filePath("stub/calls.jsonl"));
        if (file.open(QIODevice::ReadOnly))
            for (const QByteArray &line : file.readAll().split('\n'))
                if (!line.trimmed().isEmpty())
                    tasks << QJsonDocument::fromJson(line).object().value("task").toString();
        return tasks;
    }
};

} // namespace

class Window : public QObject {
    Q_OBJECT
private slots:
    void initTestCase() { QQuickStyle::setStyle("Material"); }

    void aStoryInTheWindow() {
        const QString plugin = qEnvironmentVariable("STORYTELLER"), stub = plugin + "/tests/stub_ai.py";
        Desk desk(plugin, stub, qEnvironmentVariable("SHOTS"));
        QVERIFY(desk.show());
        desk.window->resize(1280, 860);
        QTest::qWait(300);
        desk.shot("01-library-empty");

        // --- Write me a story, by its key, answered in Omabook's own dialog.
        desk.key(Qt::Key_W, Qt::ControlModifier | Qt::ShiftModifier);
        QTRY_VERIFY2(desk.value("pluginAsk", "opened").toBool(), "Ctrl+Shift+W did not ask what the reader is in the mood for");
        QCOMPARE(desk.value("pluginAskTitle", "text").toString(), QString("What are you in the mood for?"));
        desk.shot("02-mood");
        desk.type("a quiet mystery");
        desk.key(Qt::Key_Return);
        QTRY_VERIFY(!desk.value("pluginAsk", "visible").toBool());
        QTRY_VERIFY_WITH_TIMEOUT(desk.stories().size() == 1, 30000);
        QTRY_VERIFY_WITH_TIMEOUT(desk.reader->isOpen(), 10000);
        const qint64 book = desk.stories().first().id;
        QCOMPARE(desk.reader->bookId(), book);
        QCOMPARE(desk.reader->count(), 1);
        QTRY_VERIFY(desk.view().value("mine").toBool());
        QTRY_VERIFY(desk.find("storytellerState"));
        QTRY_VERIFY(desk.find("storytellerState")->isVisible());
        desk.shot("03-story-open");
        qInfo() << "state line:" << desk.value("storytellerState", "text").toString();

        // --- Typing in the steer field must not drive the reader.
        QVERIFY(desk.click("storytellerSteer"));
        QTRY_VERIFY(desk.value("storytellerSteer", "activeFocus").toBool());
        const QString wish = "more of the ferryman b l n p g t w a f m h";
        desk.type(wish);
        QCOMPARE(desk.value("storytellerSteer", "text").toString(), wish);
        QVERIFY2(desk.reader->isOpen() && desk.reader->bookId() == book, "typing closed or changed the book");
        QCOMPARE(desk.reader->section(), 0);
        QVERIFY2(desk.reader->bookmarks().isEmpty(), "typing 'b' set a bookmark");
        QVERIFY2(!desk.value("readerGraph", "visible").toBool(), "typing 'm' opened the graph");
        desk.shot("04-typing-steer");
        desk.key(Qt::Key_Return);
        // The reader is in the last chapter, so the steer writes chapter two now.
        QTRY_VERIFY_WITH_TIMEOUT(desk.reader->count() == 2, 30000);
        QCOMPARE(desk.reader->section(), 0);
        QVERIFY2(desk.calls().contains("replan"), "steering did not revise the plan");
        QVERIFY2(!desk.value("storytellerSteer", "activeFocus").toBool(), "the steer field kept the keyboard after Enter");
        QTRY_VERIFY(desk.view().value("state").toString() == "idle");
        desk.shot("05-steered-chapter-two");

        // --- Reading on: page turns until the next chapter is written.
        // Space and PageDown turn pages; Right goes to the next chapter.
        int turns = 0;
        while (desk.reader->section() < 1 && turns++ < 60) {
            desk.key(Qt::Key_PageDown);
            QTest::qWait(350);
        }
        QCOMPARE(desk.reader->section(), 1);
        for (int more = 0; more < 8 && desk.reader->fraction() < 0.4; ++more) {
            desk.key(Qt::Key_PageDown);
            QTest::qWait(350);
            ++turns;
        }
        desk.shot("05b-after-turns");
        qInfo() << "after" << turns << "turns: section" << desk.reader->section() << "fraction" << desk.reader->fraction();
        const int section = desk.reader->section();
        const double fraction = desk.reader->fraction();
        QVERIFY(section == 1);
        // page.turned comes a moment after the reader stops; then the chapter is written.
        QTRY_VERIFY_WITH_TIMEOUT(desk.view().value("state").toString() == "running" || desk.reader->count() == 3, 8000);
        desk.shot("06-writing-chapter-three");
        QTRY_VERIFY_WITH_TIMEOUT(desk.reader->count() == 3, 30000);
        QTest::qWait(600);
        QCOMPARE(desk.reader->section(), section);
        QVERIFY2(qAbs(desk.reader->fraction() - fraction) < 0.02, "the reader lost its place when the book grew");
        desk.shot("07-chapter-three-arrived");
        // One chapter ahead and no more.
        QTest::qWait(2500);
        QCOMPARE(desk.reader->count(), 3);

        // --- What you know so far, and the graph view on the reader's scope.
        QTRY_VERIFY(desk.view().value("known").toArray().size() > 0);
        QVERIFY(desk.click("storytellerGraph"));
        QTRY_VERIFY2(desk.value("readerGraph", "visible").toBool(), "the graph view did not open");
        desk.shot("08-graph");
        desk.key(Qt::Key_Escape);
        QTRY_VERIFY(!desk.value("readerGraph", "visible").toBool());
        QVERIFY(desk.reader->isOpen());

        // --- Ask the author, from the panel.
        QVERIFY(desk.click("storytellerAsk"));
        QTRY_VERIFY(desk.value("storytellerAsk", "activeFocus").toBool());
        desk.type("why does she count everything");
        desk.key(Qt::Key_Return);
        QTRY_VERIFY_WITH_TIMEOUT(desk.value("storytellerAnswer", "text").toString().contains("NO-PLAN"), 15000);
        desk.shot("09-answer");

        // --- A request that can't be granted comes back as an error, which the panel shows.
        {
            QSignalSpy answered(desk.backend->scripts(), &ScriptPlugins::answered);
            QQuickItem *panel = desk.find("storytellerState");
            while (panel && !panel->property("plugin").isValid())
                panel = panel->parentItem();
            QVERIFY(panel);
            QVERIFY(QMetaObject::invokeMethod(panel, "tell", Q_ARG(QVariant, "steer"), Q_ARG(QVariant, "")));
            QTRY_VERIFY(answered.size() >= 1);
            qInfo() << "refused:" << answered.last().at(2).toString();
            QTRY_VERIFY(desk.value("storytellerProblem", "text").toString().contains("Say what should happen"));
            desk.shot("09b-problem");
        }

        // --- Branch from here, by its key.
        desk.key(Qt::Key_B, Qt::ControlModifier | Qt::ShiftModifier);
        QTRY_VERIFY2(desk.value("pluginAsk", "opened").toBool(), "Ctrl+Shift+B did not ask how the branch should differ");
        desk.type("she burns the ledger");
        desk.shot("10-branch-ask");
        desk.key(Qt::Key_Return);
        QTRY_VERIFY_WITH_TIMEOUT(desk.stories().size() == 2, 30000);
        QTRY_VERIFY_WITH_TIMEOUT(desk.reader->bookId() != book && desk.reader->isOpen(), 10000);
        QTRY_COMPARE(desk.reader->count(), 3);
        QTRY_COMPARE(desk.reader->section(), 2);
        QTRY_VERIFY(desk.view().value("lineage").toString().startsWith("A branch of"));
        desk.shot("11-branch-open");

        // --- A book by a person: no panel, no story commands.
        write(desk.dir.filePath("Plain.md"), "# One\n\nA plain book by a person.\n\n# Two\n\nIt has two chapters.\n");
        const qint64 plain = desk.backend->library()->add(desk.dir.filePath("Plain.md")).id;
        desk.backend->reload();
        desk.reader->close();
        QTRY_VERIFY(!desk.reader->isOpen());
        desk.shot("12-library");
        desk.reader->openBook(plain);
        QTRY_VERIFY(desk.reader->isOpen() && desk.reader->bookId() == plain);
        QTest::qWait(500);
        QQuickItem *state = desk.find("storytellerState");
        QVERIFY2(!state || !state->isVisible() || state->mapToScene(QPointF(0, 0)).x() >= desk.window->width(), "the panel shows beside a person's book");
        const int before = desk.stories().size();
        const int asked = desk.calls().size();
        desk.key(Qt::Key_B, Qt::ControlModifier | Qt::ShiftModifier);
        desk.key(Qt::Key_S, Qt::ControlModifier | Qt::ShiftModifier);
        QTest::qWait(500);
        QVERIFY2(!desk.value("pluginAsk", "opened").toBool(), "a story command was offered on a person's book");
        QCOMPARE(desk.stories().size(), before);
        QCOMPARE(desk.calls().size(), asked);
        desk.shot("13-plain-book");

        qInfo() << "requests to the model:" << desk.calls();
        for (const QString &warning : desk.warnings)
            qWarning() << "QML:" << warning;
        QVERIFY2(desk.warnings.isEmpty(), qPrintable(desk.warnings.join("\n")));
    }
};

QTEST_MAIN(Window)
#include "harness.moc"
