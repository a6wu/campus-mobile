import 'package:campus_mobile/ui/router.dart';
import 'package:campus_mobile/ui/theme/app_theme.dart';
import 'package:campus_mobile/ui/views/home.dart';
import 'package:campus_mobile/ui/views/map.dart';
import 'package:campus_mobile/ui/views/notifications.dart';
import 'package:campus_mobile/ui/views/profile.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_analytics/observer.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

void main() => runApp(CampusMobile());

class CampusMobile extends StatelessWidget {
  static FirebaseAnalytics analytics = FirebaseAnalytics();
  static FirebaseAnalyticsObserver observer =
      FirebaseAnalyticsObserver(analytics: analytics);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'UC San Diego',
      theme: ThemeData(
        primarySwatch: ColorPrimary,
        accentColor: Color(0xFFFFFFFF),
        brightness: Brightness.light,
        buttonColor: Color(0xFF034263),
        iconTheme: IconThemeData(
          color: Colors.blue[900],
        ),
      ),
      darkTheme: ThemeData(
        primarySwatch: ColorPrimary,
        accentColor: ColorPrimary,
        brightness: Brightness.dark,
        buttonColor: Color(0xFFFFFFFF),
        iconTheme: IconThemeData(
          color: Color(0xFFFFFFFF),
        ),
      ),
      home: ChangeNotifierProvider<BottomNavigationBarProvider>(
        child: BottomNavigationBarExample(),
        builder: (BuildContext context) => BottomNavigationBarProvider(),
      ),
      onGenerateRoute: Router.generateRoute,
      navigatorObservers: [
        FirebaseAnalyticsObserver(analytics: analytics),
      ],
    );
  }
}

class BottomNavigationBarExample extends StatefulWidget {
  @override
  _BottomNavigationBarExampleState createState() =>
      _BottomNavigationBarExampleState();
}

class _BottomNavigationBarExampleState
    extends State<BottomNavigationBarExample> {
  var currentTab = [
    Home(),
    Map(),
    Notifications(),
    Profile(),
  ];

  @override
  Widget build(BuildContext context) {
    var provider = Provider.of<BottomNavigationBarProvider>(context);
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(42),
        child: AppBar(
          centerTitle: true,
          title: Container(
            padding: EdgeInsets.only(top: 4),
            child: Center(
              child: Image.asset(
                'assets/images/UCSanDiegoLogo-nav.png',
                height: 28,
              ),
            ),
          ),
        ),
      ),
      body: currentTab[provider.currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: provider.currentIndex,
        onTap: (index) {
          provider.currentIndex = index;
        },
        items: [
          BottomNavigationBarItem(
            icon: new Icon(Icons.home),
            title: new Text('Home'),
          ),
          BottomNavigationBarItem(
            icon: new Icon(Icons.map),
            title: new Text('Map'),
          ),
          BottomNavigationBarItem(
            icon: new Icon(Icons.notifications),
            title: new Text('Notifications'),
          ),
          BottomNavigationBarItem(
            icon: new Icon(Icons.person),
            title: new Text('User Profile'),
          ),
        ],
        showSelectedLabels: false,
        showUnselectedLabels: false,
        selectedItemColor: IconTheme.of(context).color,
        unselectedItemColor: Colors.grey.shade500,
      ),
    );
  }
}

class BottomNavigationBarProvider with ChangeNotifier {
  int _currentIndex = 0;
  get currentIndex => _currentIndex;
  set currentIndex(int index) {
    _currentIndex = index;
    notifyListeners();
  }
}
